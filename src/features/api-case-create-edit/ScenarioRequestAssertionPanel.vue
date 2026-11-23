<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronDown, Code, Copy, FileText, Hash, Plus, Server, Timer, Trash2, Variable } from '@lucide/vue'
import { computed } from 'vue'

import { AppSwitch } from '@/shared/ui'

interface AssertionRule {
  header?: string
  variableName?: string
  expression?: string
  condition?: string
  expectedValue?: string
}

interface AssertionRow {
  id?: string
  assertionType?: string
  name?: string
  enabled?: boolean
  condition?: string
  expectedValue?: string
  assertionBodyType?: string
  expressionType?: string
  assertions?: AssertionRule[]
  variableAssertionItems?: AssertionRule[]
  jsonPathAssertion?: { assertions: AssertionRule[] }
  xpathAssertion?: { assertions: AssertionRule[] }
  regexAssertion?: { assertions: AssertionRule[] }
  script?: string
}

const props = defineProps<{
  rows: AssertionRow[]
  activeIndex: number
  conditions: Array<{ label: string; value: string }>
}>()

const emit = defineEmits<{
  add: [type: string]
  select: [index: number]
  move: [index: number, delta: -1 | 1]
  duplicate: [index: number]
  remove: [index: number]
  addRule: [rules: AssertionRule[], seed: AssertionRule]
  removeRule: [rules: AssertionRule[], index: number, seed: AssertionRule]
}>()

const types = [
  { value: 'RESPONSE_CODE', label: '状态码', icon: Hash, color: '#165dff' },
  { value: 'RESPONSE_HEADER', label: '响应头', icon: Server, color: '#0891b2' },
  { value: 'RESPONSE_BODY', label: '响应体', icon: FileText, color: '#7816ff' },
  { value: 'RESPONSE_TIME', label: '响应时间', icon: Timer, color: '#00b42a' },
  { value: 'VARIABLE', label: '变量', icon: Variable, color: '#ff7d00' },
  { value: 'SCRIPT', label: '脚本', icon: Code, color: '#e0186c' },
]
const bodyTypes = [
  { value: 'JSON_PATH', label: 'JSONPath', placeholder: '$.data.id' },
  { value: 'X_PATH', label: 'XPath', placeholder: '/root/id' },
  { value: 'REGEX', label: '正则', placeholder: 'id=(\\d+)' },
]
const scriptExample = 'if (variables.get("status") !== "READY") fail("状态不正确");'
const activeRow = computed(() => props.rows[props.activeIndex])
const activeType = computed(() => activeRow.value?.assertionType)
const isTime = computed(() => activeType.value === 'RESPONSE_TIME')
const subjectKey = computed(() => activeType.value === 'RESPONSE_HEADER' ? 'header' : 'variableName')
const subjectLabel = computed(() => subjectKey.value === 'header' ? 'Header 名称' : '变量名')
const namedRules = computed(() => subjectKey.value === 'header' ? activeRow.value?.assertions : activeRow.value?.variableAssertionItems)
const bodyRules = computed(() => {
  const row = activeRow.value
  switch (row?.assertionBodyType) {
    case 'X_PATH': return row.xpathAssertion?.assertions
    case 'REGEX': return row.regexAssertion?.assertions
    default: return row?.jsonPathAssertion?.assertions
  }
})
const bodyPlaceholder = computed(() => bodyTypes.find(type => type.value === activeRow.value?.assertionBodyType)?.placeholder)

function selectBodyType(row: AssertionRow, type: string) {
  row.assertionBodyType = type
  row.expressionType = type
}
</script>

<template>
  <div class="scenario-assertion">
    <aside class="scenario-assertion__sidebar" aria-label="断言列表">
      <div class="scenario-assertion__toolbar">
        <el-dropdown
          trigger="click" placement="bottom-start" :show-arrow="false" :teleported="false"
          :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 2] } }] }"
          popper-class="scenario-assertion-menu" @command="emit('add', $event)"
        >
          <button type="button" class="scenario-assertion__trigger">
            <Plus :size="11" aria-hidden="true" />添加断言<ChevronDown :size="10" aria-hidden="true" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="type in types" :key="type.value" :command="type.value">
                <component :is="type.icon" :size="12" :style="{ color: type.color }" aria-hidden="true" />
                {{ type.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="rows.length" class="scenario-assertion__rows">
        <div
          v-for="(row, index) in rows" :key="row.id || index" class="scenario-assertion__row"
          :class="{ 'is-active': index === activeIndex }"
        >
          <button type="button" class="scenario-assertion__select" :aria-pressed="index === activeIndex" @click="emit('select', index)">
            <span class="scenario-assertion__dot" :class="{ 'is-enabled': row.enabled !== false }" aria-hidden="true" />
            <span class="scenario-assertion__name" :title="row.name">{{ row.name || '未命名断言' }}</span>
          </button>
          <div class="scenario-assertion__row-actions">
            <button type="button" aria-label="上移断言" title="上移" :disabled="index === 0" @click="emit('move', index, -1)"><ArrowUp :size="13" /></button>
            <button type="button" aria-label="下移断言" title="下移" :disabled="index === rows.length - 1" @click="emit('move', index, 1)"><ArrowDown :size="13" /></button>
            <button type="button" aria-label="复制断言" title="复制" @click="emit('duplicate', index)"><Copy :size="13" /></button>
            <button type="button" class="is-danger" aria-label="删除断言" title="删除" @click="emit('remove', index)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>
    </aside>

    <section class="scenario-assertion__detail" aria-label="断言配置">
      <p v-if="!activeRow" class="scenario-assertion__empty">添加断言后进行配置</p>
      <div v-else :key="activeRow.id" class="scenario-assertion__fields">
        <div class="scenario-assertion__heading">
          <label class="scenario-assertion__label">断言名称
            <input v-model="activeRow.name" class="scenario-assertion__input" />
          </label>
          <div class="scenario-assertion__enabled">
            <AppSwitch :model-value="activeRow.enabled !== false" label="启用断言" active-color="#165dff" @update:model-value="activeRow.enabled = $event" />
            <span>启用</span>
          </div>
        </div>

        <div v-if="activeType === 'RESPONSE_CODE' || isTime" class="scenario-assertion__pair">
          <label class="scenario-assertion__label">比较方式
            <select v-model="activeRow.condition" class="scenario-assertion__input">
              <option v-for="condition in conditions" :key="condition.value" :value="condition.value">{{ condition.label }}</option>
            </select>
          </label>
          <label class="scenario-assertion__label">{{ isTime ? '响应时间 (ms)' : '期望状态码' }}
            <input v-if="isTime" :value="activeRow.expectedValue" class="scenario-assertion__input" type="number" min="0" @input="activeRow.expectedValue = ($event.target as HTMLInputElement).value" />
            <input v-else v-model="activeRow.expectedValue" class="scenario-assertion__input" placeholder="200" />
          </label>
        </div>

        <template v-else-if="namedRules && (activeType === 'RESPONSE_HEADER' || activeType === 'VARIABLE')">
          <div v-for="(rule, index) in namedRules" :key="index" class="scenario-assertion__fields scenario-assertion__named-rule">
            <label class="scenario-assertion__label">{{ subjectLabel }}
              <input v-model="rule[subjectKey]" class="scenario-assertion__input" :placeholder="subjectKey === 'header' ? 'Content-Type' : 'orderId'" />
            </label>
            <div class="scenario-assertion__pair">
              <label class="scenario-assertion__label">比较方式
                <select v-model="rule.condition" class="scenario-assertion__input">
                  <option v-for="condition in conditions" :key="condition.value" :value="condition.value">{{ condition.label }}</option>
                </select>
              </label>
              <label class="scenario-assertion__label">期望值
                <input v-model="rule.expectedValue" class="scenario-assertion__input" />
              </label>
            </div>
            <div class="scenario-assertion__rule-actions">
              <button v-if="namedRules.length > 1" type="button" class="is-danger" aria-label="删除校验项" title="删除校验项" @click="emit('removeRule', namedRules, index, { [subjectKey]: '' })"><Trash2 :size="12" /></button>
              <button v-if="index === namedRules.length - 1" type="button" aria-label="添加校验项" title="添加校验项" @click="emit('addRule', namedRules, { [subjectKey]: '' })"><Plus :size="12" /></button>
            </div>
          </div>
        </template>

        <template v-else-if="activeType === 'RESPONSE_BODY' && bodyRules">
          <div class="scenario-assertion__body-types" role="group" aria-label="响应体断言方式">
            <button
              v-for="type in bodyTypes" :key="type.value" type="button"
              :aria-pressed="activeRow.assertionBodyType === type.value" @click="selectBodyType(activeRow, type.value)"
            >{{ type.label }}</button>
          </div>
          <div class="scenario-assertion__body-rows">
            <div v-for="(rule, index) in bodyRules" :key="index" class="scenario-assertion__body-rule">
              <input v-model="rule.expression" class="scenario-assertion__input" aria-label="表达式" :placeholder="bodyPlaceholder" />
              <select v-model="rule.condition" class="scenario-assertion__input" aria-label="比较方式">
                <option v-for="condition in conditions" :key="condition.value" :value="condition.value">{{ condition.label }}</option>
              </select>
              <input v-model="rule.expectedValue" class="scenario-assertion__input" aria-label="期望值" placeholder="期望值" />
              <button type="button" class="is-danger" aria-label="删除校验项" title="删除校验项" @click="emit('removeRule', bodyRules, index, { expression: '' })"><Trash2 :size="13" /></button>
            </div>
          </div>
          <button type="button" class="scenario-assertion__add-rule" @click="emit('addRule', bodyRules, { expression: '' })">
            <Plus :size="11" aria-hidden="true" />添加校验项
          </button>
        </template>

        <template v-else-if="activeType === 'SCRIPT'">
          <p class="scenario-assertion__hint">脚本执行成功表示断言通过；使用 fail(...) 表示断言失败。</p>
          <textarea
            v-model="activeRow.script" class="scenario-assertion__code" rows="10"
            aria-label="脚本内容" :placeholder="scriptExample" spellcheck="false"
          ></textarea>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scenario-assertion { display: grid; grid-template-columns: 230px minmax(0, 1fr); min-height: 300px; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; }
.scenario-assertion__sidebar { border-right: 1px solid #e5e6eb; background: #fafbfe; }
.scenario-assertion__toolbar { padding: 8px; border-bottom: 1px solid #e5e6eb; }
.scenario-assertion__toolbar :deep(.el-dropdown) { display: block; }
.scenario-assertion__trigger { display: flex; width: 100%; height: 28px; align-items: center; justify-content: center; gap: 6px; padding: 0; border: 0; border-radius: 10px; background: #165dff; color: #fff; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.scenario-assertion__sidebar :deep(.scenario-assertion-menu) { width: 100%; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%); }
.scenario-assertion__sidebar :deep(.el-dropdown-menu) { padding: 4px; }
.scenario-assertion__sidebar :deep(.el-dropdown-menu__item) { gap: 8px; padding: 8px 12px; border-radius: 8px; color: #1d2129; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.scenario-assertion__sidebar :deep(.el-dropdown-menu__item:not(.is-disabled):is(:hover, :focus)) { background: oklch(0.985 0.002 247.839); color: #1d2129; }
.scenario-assertion__rows { display: grid; gap: 4px; padding: 8px; }
.scenario-assertion__row { position: relative; min-width: 0; padding: 8px; border-radius: 10px; }
.scenario-assertion__row.is-active { background: #e8f3ff; }
.scenario-assertion__select { display: flex; width: 100%; min-width: 0; align-items: center; gap: 6px; padding: 0; border: 0; background: transparent; color: #1d2129; font: inherit; font-weight: 500; text-align: left; }
.scenario-assertion__row.is-active .scenario-assertion__select { color: #165dff; }
.scenario-assertion__select::before { position: absolute; inset: 0; border-radius: inherit; content: ""; }
.scenario-assertion__dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: #c9cdd4; }
.scenario-assertion__dot.is-enabled { background: #00b42a; }
.scenario-assertion__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scenario-assertion__row-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.scenario-assertion__row-actions button { position: relative; }
.scenario-assertion__row-actions button, .scenario-assertion__body-rule button, .scenario-assertion__rule-actions button { display: grid; width: 24px; height: 24px; flex: none; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #86909c; }
.scenario-assertion__row-actions button:not(:disabled):hover, .scenario-assertion__rule-actions button:hover { background: #f2f3f5; }
.scenario-assertion button.is-danger { color: #f53f3f; }
.scenario-assertion button.is-danger:hover { background: #fee; }
.scenario-assertion__detail { display: flex; min-width: 0; flex-direction: column; padding: 16px; }
.scenario-assertion__empty { margin: auto; color: #c9cdd4; }
.scenario-assertion__fields, .scenario-assertion__label { display: grid; min-width: 0; gap: 12px; }
.scenario-assertion__label { gap: 4px; color: #86909c; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.scenario-assertion__heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 12px; }
.scenario-assertion__enabled { display: flex; height: 32px; align-items: center; gap: 8px; color: #1d2129; font-size: 11px; }
.scenario-assertion__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.scenario-assertion__input { box-sizing: border-box; width: 100%; min-width: 0; height: 32px; padding: 0 9px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #1d2129; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.scenario-assertion__input:focus { border-color: #165dff; outline: none; }
.scenario-assertion__input[type="number"] { appearance: textfield; }
.scenario-assertion__input::-webkit-inner-spin-button { appearance: none; }
.scenario-assertion__named-rule { position: relative; }
.scenario-assertion__rule-actions { position: absolute; top: -4px; right: 0; display: flex; }
.scenario-assertion__rule-actions button:not(.is-danger) { color: #165dff; }
@media (hover: hover) and (pointer: fine) {
  .scenario-assertion__named-rule:not(:hover, :focus-within) .scenario-assertion__rule-actions { opacity: 0; }
}
.scenario-assertion__body-types { display: flex; flex-wrap: wrap; gap: 8px; }
.scenario-assertion__body-types button { height: 28px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; color: #86909c; font: 500 10px/15px Inter, "Noto Sans SC", sans-serif; }
.scenario-assertion__body-types button[aria-pressed="true"] { border-color: #165dff; background: #e8f3ff; color: #165dff; }
.scenario-assertion__body-rows { display: grid; gap: 8px; }
.scenario-assertion__body-rule { display: grid; grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 28px; gap: 8px; }
.scenario-assertion__add-rule { display: inline-flex; min-height: 24px; justify-self: start; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: #165dff; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.scenario-assertion__add-rule:hover { color: #0e42d2; }
.scenario-assertion__hint { margin: 0; padding: 10px; border-radius: 10px; background: #e8f3ff; color: #165dff; font-size: 10px; line-height: 15px; }
.scenario-assertion__code { box-sizing: border-box; display: block; width: 100%; min-width: 0; min-height: 189px; padding: 12px; border: 0; border-radius: 10px; background: #101827; color: #dde7f4; font: 400 11px/16.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; resize: vertical; }
.scenario-assertion__code::placeholder { color: #86909c; }
.scenario-assertion__code:focus-visible { outline: 1px solid #165dff; }
@media (max-width: 680px) {
  .scenario-assertion { grid-template-columns: minmax(118px, 36%) minmax(0, 1fr); }
  .scenario-assertion__detail { padding: 12px; }
  .scenario-assertion__pair { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .scenario-assertion__body-rule { grid-template-columns: repeat(3, minmax(0, 1fr)) 24px; gap: 4px; }
}
</style>
