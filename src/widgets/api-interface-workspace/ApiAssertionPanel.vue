<script setup lang="ts">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import {
  ChevronDown,
  Code2,
  Copy,
  FileText,
  Hash,
  Plus,
  Server,
  Shield,
  Sparkles,
  Timer,
  Trash2,
  Variable,
  Zap,
} from '@lucide/vue'

import { AppSwitch } from '@/shared/ui'

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

interface ApiAssertionResultRow {
  id?: string | null
  type?: string | null
  subject?: string | null
  actualValue?: string | null
}

const props = defineProps<{
  rows: ApiAssertionPanelRow[]
  activeAssertion: ApiAssertionPanelRow | null
  assertionTypeOptions: AssertionOption[]
  assertionConditionOptions: AssertionOption[]
  assertionResults: ApiAssertionResultRow[]
  hasLatestResponse: boolean
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

function assertionIcon(type?: string | null) {
  const value = (type || '').toUpperCase()
  if (value === 'RESPONSE_HEADER') return Server
  if (value === 'RESPONSE_BODY') return FileText
  if (value === 'RESPONSE_TIME') return Timer
  if (value === 'VARIABLE') return Variable
  if (value === 'SCRIPT') return Code2
  return Hash
}

function assertionActualValue(assertion: ApiAssertionPanelRow, subject?: string | null) {
  const normalizedType = String(assertion.assertionType || assertion.type || '').toUpperCase()
  const normalizedSubject = String(subject || '')
  const result = props.assertionResults.find((item) => {
    if (assertion.id && item.id !== assertion.id) return false
    if (!assertion.id && String(item.type || '').toUpperCase() !== normalizedType) return false
    return normalizedSubject ? String(item.subject || '') === normalizedSubject : true
  })
  if (result?.actualValue === null || result?.actualValue === undefined || result.actualValue === '') return '—'
  return String(result.actualValue)
}

function emitUpdateResponseTime(assertion: ApiAssertionPanelRow | null, value: number | undefined) {
  emit('updateResponseTime', assertion, value)
}

function emitActiveResponseTime(value: number | undefined) {
  emitUpdateResponseTime(props.activeAssertion, value)
}

function assertionTone(type?: string | null) {
  const value = (type || '').toUpperCase()
  if (value === 'RESPONSE_HEADER') return { label: '响应头', color: '#00AECF', bg: '#E5F6FA' }
  if (value === 'RESPONSE_BODY') return { label: '响应体', color: '#7816FF', bg: '#F0E8FF' }
  if (value === 'RESPONSE_TIME') return { label: '响应时间', color: '#00B42A', bg: '#E6F9EC' }
  if (value === 'VARIABLE') return { label: '变量', color: '#FF7D00', bg: '#FFF2E5' }
  if (value === 'SCRIPT') return { label: '脚本', color: '#E0186C', bg: '#FCE8F2' }
  return { label: '状态码', color: '#165DFF', bg: '#E8EEFF' }
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
          <el-dropdown trigger="click" popper-class="api-assertion-add-dropdown" @command="emitAddFromCommand">
            <button type="button" class="api-legacy-primary">
              <Plus class="api-button-plus" :size="12" aria-hidden="true" />
              添加断言
              <ChevronDown class="api-button-chevron" :size="10" aria-hidden="true" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">
                  <component :is="assertionIcon(item.value)" :size="13" aria-hidden="true" />
                  <span>{{ item.label }}断言</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button
            type="button"
            class="api-assertion-batch-link"
            :disabled="!hasLatestResponse"
            :title="hasLatestResponse ? '从最近响应快速生成断言' : '请先发送请求，再快速生成断言'"
            @click="emitAddFromLatestResponse('all')"
          >
            <Zap class="api-button-spark" :size="10" aria-hidden="true" />
            快速生成
          </button>
        </div>
        <button
          v-for="(assertion, index) in rows"
          :key="assertion.id || index"
          type="button"
          :class="['api-assertion-list-item', { 'is-active': activeAssertion?.id === assertion.id }]"
          @click="emit('select', assertion)"
        >
          <span class="api-assertion-list-item__main">
            <AppSwitch
              :model-value="assertion.enabled !== false"
              :label="assertion.enabled === false ? '启用断言' : '停用断言'"
              @click.stop
              @update:model-value="toggleAssertion(assertion)"
            />
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
          </span>
        </button>
        <div v-if="!rows.length" class="api-assertion-empty">
          <Shield class="api-assertion-empty__icon" :size="24" aria-hidden="true" />
          <p>暂无断言</p>
          <small>点击「添加」开始配置</small>
        </div>
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
            <span class="api-assertion-name-actions__divider" aria-hidden="true" />
          </div>
          <label class="api-figma-enable">
            <AppSwitch
              :model-value="activeAssertion.enabled !== false"
              :label="activeAssertion.enabled === false ? '启用断言' : '停用断言'"
              @update:model-value="toggleAssertion(activeAssertion)"
            />
            <em>启用</em>
          </label>
        </div>

        <div v-if="activeAssertion.assertionType === 'RESPONSE_CODE'" class="api-assertion-type-panel">
          <div class="api-assertion-form-grid">
            <label>
              <span>比较条件</span>
              <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; emit('dirty')">
                <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label>
              <span>期望状态码</span>
              <el-input v-model="activeAssertion.expectedValue" placeholder="200" @input="emit('dirty')" />
            </label>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_HEADER'" class="api-assertion-type-panel">
          <div class="api-assertion-section-toolbar">
            <span />
            <button type="button" class="api-assertion-toolbar-add" @click="emit('addItem', activeAssertion.assertions || (activeAssertion.assertions = []), { header: '' })"><Plus :size="12" />添加项</button>
          </div>
          <div class="api-assertion-item-list">
            <div :class="['api-assertion-table-head', 'is-header', { 'has-current-value': assertionResults.length }]">
              <span>Header 名称</span>
              <span>比较条件</span>
              <span>期望值</span>
              <span v-if="assertionResults.length">当前值</span>
              <span>操作</span>
            </div>
            <div v-for="(item, index) in activeAssertion.assertions" :key="`${activeAssertion.id}-header-${index}`" :class="['api-assertion-item-row', 'is-header', { 'has-current-value': assertionResults.length }]">
              <el-input v-model="item.header" class="api-assertion-expression-input" placeholder="响应头名称" @input="activeAssertion.expression = item.header || ''; emit('dirty')" />
              <el-select v-model="item.condition" class="api-assertion-condition-select" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" class="api-assertion-expected-input" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <span v-if="assertionResults.length" class="api-assertion-current-value">{{ assertionActualValue(activeAssertion, item.header) }}</span>
              <button type="button" class="api-assertion-icon-action" title="复制" aria-label="复制" @click="emit('copyItem', activeAssertion.assertions || [], index)"><Copy :size="13" /></button>
              <button type="button" class="api-assertion-icon-action is-danger" title="删除" aria-label="删除" @click="emit('removeItem', activeAssertion.assertions || [], index, { header: '', condition: 'EQUALS', expectedValue: '' })"><Trash2 :size="13" /></button>
            </div>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_BODY'" class="api-assertion-type-panel">
          <div class="api-assertion-body-toolbar">
            <span class="api-assertion-body-toolbar__label">断言类型</span>
            <el-radio-group v-model="activeAssertion.assertionBodyType" @change="activeAssertion.expressionType = activeAssertion.assertionBodyType; emit('dirty')">
              <el-radio-button value="JSON_PATH">JSONPath</el-radio-button>
              <el-radio-button value="X_PATH">XPath</el-radio-button>
              <el-radio-button value="REGEX">Regex</el-radio-button>
            </el-radio-group>
            <el-select v-if="activeAssertion.assertionBodyType === 'X_PATH'" v-model="activeAssertionBodyGroup(activeAssertion).responseFormat" class="api-assertion-format-select" @change="emit('dirty')">
              <el-option label="XML" value="XML" />
              <el-option label="HTML" value="HTML" />
            </el-select>
            <button type="button" class="api-assertion-fast-extract" :disabled="!hasLatestResponseBody" :title="fastExtractionTitle" @click="emit('openFastExtraction', activeAssertion, activeAssertionBodyGroup(activeAssertion).assertions[0])"><Zap :size="10" />快速提取</button>
            <span class="api-assertion-body-toolbar__spacer" />
            <button type="button" class="api-assertion-toolbar-add" @click="emit('addItem', activeAssertionBodyGroup(activeAssertion).assertions, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType) })"><Plus :size="12" />添加项</button>
          </div>
          <div class="api-assertion-item-list">
            <div :class="['api-assertion-table-head', 'is-body', { 'has-current-value': assertionResults.length }]">
              <span>表达式</span>
              <span>比较条件</span>
              <span>期望值</span>
              <span v-if="assertionResults.length">当前值</span>
              <span>操作</span>
            </div>
            <div v-for="(item, index) in activeAssertionBodyGroup(activeAssertion).assertions" :key="`${activeAssertion.id}-body-${activeAssertion.assertionBodyType}-${index}`" :class="['api-assertion-item-row', 'is-body', { 'has-current-value': assertionResults.length }]">
              <el-input v-model="item.expression" class="api-assertion-expression-input" placeholder="$.data.id / /root/id / 正则" @input="activeAssertion.expression = item.expression || ''; emit('dirty')" />
              <el-select v-model="item.condition" class="api-assertion-condition-select" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" class="api-assertion-expected-input" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <span v-if="assertionResults.length" class="api-assertion-current-value">{{ assertionActualValue(activeAssertion, item.expression) }}</span>
              <button type="button" class="api-assertion-icon-action is-extract" :disabled="!hasLatestResponseBody" :title="fastExtractionTitle" aria-label="快速提取" @click="emit('openFastExtraction', activeAssertion, item)"><Sparkles :size="13" /></button>
              <button type="button" class="api-assertion-icon-action" title="复制" aria-label="复制" @click="emit('copyItem', activeAssertionBodyGroup(activeAssertion).assertions, index)"><Copy :size="13" /></button>
              <button type="button" class="api-assertion-icon-action is-danger" title="删除" aria-label="删除" @click="emit('removeItem', activeAssertionBodyGroup(activeAssertion).assertions, index, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType), condition: 'EQUALS', expectedValue: '' })"><Trash2 :size="13" /></button>
            </div>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_TIME'" class="api-assertion-type-panel">
          <div class="api-assertion-time-grid">
            <label>
              <span>比较条件</span>
              <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; emit('dirty')">
                <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label>
              <span>阈值 (ms)</span>
              <input
                class="api-assertion-time-input"
                type="number"
                min="1"
                step="100"
                :value="Number(activeAssertion.expectedValue || 1000)"
                aria-label="阈值 (ms)"
                @input="emitActiveResponseTime(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <em>ms</em>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'VARIABLE'" class="api-assertion-type-panel">
          <div class="api-assertion-section-toolbar">
            <span />
            <button type="button" class="api-assertion-toolbar-add" @click="emit('addItem', activeAssertion.variableAssertionItems || (activeAssertion.variableAssertionItems = []), { variableName: '' })"><Plus :size="12" />添加项</button>
          </div>
          <div class="api-assertion-item-list">
            <div :class="['api-assertion-table-head', 'is-variable', { 'has-current-value': assertionResults.length }]">
              <span>变量名</span>
              <span>比较条件</span>
              <span>期望值</span>
              <span v-if="assertionResults.length">当前值</span>
              <span>操作</span>
            </div>
            <div v-for="(item, index) in activeAssertion.variableAssertionItems" :key="`${activeAssertion.id}-variable-${index}`" :class="['api-assertion-item-row', 'is-variable', { 'has-current-value': assertionResults.length }]">
              <el-input v-model="item.variableName" class="api-assertion-expression-input" placeholder="变量名" @input="activeAssertion.expression = item.variableName || ''; emit('dirty')" />
              <el-select v-model="item.condition" class="api-assertion-condition-select" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" class="api-assertion-expected-input" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <span v-if="assertionResults.length" class="api-assertion-current-value">{{ assertionActualValue(activeAssertion, item.variableName) }}</span>
              <button type="button" class="api-assertion-icon-action" title="复制" aria-label="复制" @click="emit('copyItem', activeAssertion.variableAssertionItems || [], index)"><Copy :size="13" /></button>
              <button type="button" class="api-assertion-icon-action is-danger" title="删除" aria-label="删除" @click="emit('removeItem', activeAssertion.variableAssertionItems || [], index, { variableName: '', condition: 'EQUALS', expectedValue: '' })"><Trash2 :size="13" /></button>
            </div>
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
            language="text"
            placeholder="if (response.statusCode !== 200) { throw new Error('状态码不正确') }"
            :show-format-button="false"
            line-numbers="off"
            :folding="false"
            :font-size="12"
            :line-height="20"
            :line-decorations-width="10"
            :padding-top="12"
            theme-variant="dark"
            @change="emit('dirty')"
          >
            <template #toolbar>
              <span class="api-processor-language-tag"><Code2 :size="11" aria-hidden="true" />JavaScript</span>
              <span class="api-assertion-api-chip">setVar / getVar / request / response / log / fail</span>
            </template>
          </ApiCodeEditor>
          <label class="api-figma-field">
            <span>说明</span>
            <el-input v-model="activeAssertion.description" placeholder="选填" @input="emit('dirty')" />
          </label>
        </div>
      </section>
      <section v-else class="api-assertion-detail api-assertion-empty api-assertion-empty--inline">
        <Shield :size="32" aria-hidden="true" />
        <p>请选择一个断言进行编辑</p>
      </section>
    </div>
  </div>
</template>

<style scoped src="./styles/api-assertion-panel.css"></style>
