<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronDown, Clock, Code, Copy, Database, Layers, Plus, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import type { ApiKeyValueInput } from '@/entities/api-automation'
import type { DbConnectionItem } from '@/entities/config'
import { AppSwitch } from '@/shared/ui'
import { processorExtractTypeOptions, processorRegexExtractScopeOptions } from '@/widgets/api-interface-workspace/lib/apiWorkspaceOptions'

interface ScenarioExtractRule {
  id?: string
  extractScope?: string
  extractType?: string
  variableName?: string
  expression?: string
}

interface ScenarioProcessor {
  id?: string
  processorType?: string
  name?: string
  enabled?: boolean
  script?: string
  dataSourceId?: number | null
  dataSourceName?: string
  queryTimeout?: number
  resultVariable?: string
  extractParams?: ApiKeyValueInput[]
  delayMs?: number
  extractors?: ScenarioExtractRule[]
}

const props = defineProps<{
  stage: 'pre' | 'post'
  rows: ScenarioProcessor[]
  activeIndex: number
  databaseConnections: Array<Pick<DbConnectionItem, 'id' | 'connectionName'>>
}>()
const emit = defineEmits<{
  add: [type: string]
  select: [index: number]
  move: [index: number, delta: -1 | 1]
  duplicate: [index: number]
  remove: [index: number]
  selectDatabase: [id: number | null]
}>()

const processorTypes = [
  { value: 'SCRIPT', label: 'JS 脚本', icon: Code, color: '#ff7d00' },
  { value: 'SQL', label: 'SQL', icon: Database, color: '#165dff' },
  { value: 'TIME_WAITING', label: '等待', icon: Clock, color: '#86909c' },
]
const availableProcessorTypes = computed(() => props.stage === 'post'
  ? [...processorTypes, { value: 'EXTRACT', label: '变量提取', icon: Layers, color: '#00b42a' }]
  : processorTypes)
const extractScopeOptions = processorRegexExtractScopeOptions.filter(({ value }) => value === 'BODY' || value === 'RESPONSE_HEADERS')
const extractPlaceholders: Record<string, string> = { JSON_PATH: '$.data.id', X_PATH: '/root/id', REGEX: '(.*)' }
const activeRow = computed(() => props.rows[props.activeIndex])
const scriptExample = 'variables.set("status", "READY");'
const sqlExample = 'SELECT id, status FROM orders WHERE id = {{orderId}}'

function updateNumber(row: ScenarioProcessor, field: 'queryTimeout' | 'delayMs', event: Event) {
  const input = event.target as HTMLInputElement
  const min = Number(input.min)
  const max = Number(input.max)
  const value = Number.isNaN(input.valueAsNumber) ? row[field] ?? min : input.valueAsNumber
  row[field] = Math.round(Math.min(max, Math.max(min, value)))
  input.value = String(row[field])
}

function addMapping(row: ScenarioProcessor) {
  const mappings = row.extractParams ?? (row.extractParams = [])
  mappings.push({ key: '', value: '', enabled: true })
}

function removeMapping(row: ScenarioProcessor, index: number) {
  row.extractParams?.splice(index, 1)
  if (!row.extractParams?.length) addMapping(row)
}
</script>

<template>
  <div class="scenario-pre">
    <aside class="scenario-pre__sidebar" :aria-label="stage === 'pre' ? '前置处理器列表' : '后置处理器列表'">
      <div class="scenario-pre__toolbar">
        <el-dropdown
          trigger="click" placement="bottom-start" :show-arrow="false"
          :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 2] } }] }"
          :teleported="false" popper-class="scenario-pre-menu" @command="emit('add', $event)"
        >
          <button class="scenario-pre__add" type="button">
            <Plus :size="11" aria-hidden="true" />添加处理器<ChevronDown :size="10" aria-hidden="true" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="type in availableProcessorTypes" :key="type.value" :command="type.value">
                <component :is="type.icon" :size="12" :style="{ color: type.color }" aria-hidden="true" />
                {{ type.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="scenario-pre__rows">
        <div v-if="!rows.length" class="scenario-pre__sidebar-empty">暂无处理器</div>
        <div
          v-for="(row, index) in rows" :key="row.id || index" class="scenario-pre__row"
          :class="{ 'is-active': index === activeIndex }"
        >
          <button
            type="button" class="scenario-pre__select" :aria-pressed="index === activeIndex"
            @click="emit('select', index)"
          >
            <span class="scenario-pre__dot" :class="{ 'is-enabled': row.enabled !== false }" aria-hidden="true" />
            <span class="scenario-pre__name" :title="row.name">{{ row.name || '未命名处理器' }}</span>
          </button>
          <div class="scenario-pre__row-actions">
            <button type="button" aria-label="上移处理器" title="上移" :disabled="index === 0" @click="emit('move', index, -1)"><ArrowUp :size="13" /></button>
            <button type="button" aria-label="下移处理器" title="下移" :disabled="index === rows.length - 1" @click="emit('move', index, 1)"><ArrowDown :size="13" /></button>
            <button type="button" aria-label="复制处理器" title="复制" @click="emit('duplicate', index)"><Copy :size="13" /></button>
            <button class="is-danger" type="button" aria-label="删除处理器" title="删除" @click="emit('remove', index)"><Trash2 :size="13" /></button>
          </div>
        </div>
      </div>
    </aside>

    <section class="scenario-pre__detail" aria-label="处理器配置">
      <p v-if="!activeRow" class="scenario-pre__detail-empty">从左侧添加处理器</p>
      <div v-else :key="activeRow.id" class="scenario-pre__fields">
        <div class="scenario-pre__heading">
          <label class="scenario-pre__field">
            处理器名称
            <input v-model="activeRow.name" class="scenario-pre__input" />
          </label>
          <div class="scenario-pre__enabled">
            <AppSwitch :model-value="activeRow.enabled !== false" label="启用处理器" active-color="#165dff" @update:model-value="activeRow.enabled = $event" />
            <span>启用</span>
          </div>
        </div>

        <template v-if="activeRow.processorType === 'SCRIPT'">
          <p class="scenario-pre__info">运行器固定超时 10 秒，可使用 variables.get/set、log 和 fail。</p>
          <textarea
            v-model="activeRow.script" class="scenario-pre__code is-script" rows="11"
            :placeholder="scriptExample" aria-label="脚本内容" spellcheck="false"
          ></textarea>
        </template>

        <template v-else-if="activeRow.processorType === 'SQL'">
          <div class="scenario-pre__field">
            <span>数据源</span>
            <el-select
              class="scenario-pre__datasource" aria-label="数据源" placeholder="选择数据库连接"
              :model-value="activeRow.dataSourceId" :suffix-icon="ChevronDown"
              filterable clearable @update:model-value="emit('selectDatabase', $event)"
            >
              <el-option
                v-if="activeRow.dataSourceId != null && !databaseConnections.some(connection => connection.id === activeRow?.dataSourceId)"
                :value="activeRow.dataSourceId" :label="activeRow.dataSourceName || String(activeRow.dataSourceId)" disabled
              />
              <el-option v-for="connection in databaseConnections" :key="connection.id" :value="connection.id" :label="connection.connectionName" />
            </el-select>
          </div>
          <textarea
            v-model="activeRow.script" class="scenario-pre__code is-sql" rows="7"
            :placeholder="sqlExample" aria-label="SQL 语句" spellcheck="false"
          ></textarea>
          <div class="scenario-pre__field-pair">
            <label class="scenario-pre__field">查询超时 (ms)
              <input class="scenario-pre__input" type="number" :value="activeRow.queryTimeout" min="100" max="60000" step="1000" @change="updateNumber(activeRow, 'queryTimeout', $event)" />
            </label>
            <label class="scenario-pre__field">完整结果变量
              <input v-model="activeRow.resultVariable" class="scenario-pre__input" placeholder="queryResult" />
            </label>
          </div>
          <div class="scenario-pre__field">
            <span class="scenario-pre__mapping-title">变量映射</span>
            <div v-for="(mapping, index) in activeRow.extractParams" :key="index" class="scenario-pre__mapping">
              <div class="scenario-pre__mapping-expression">
                <input v-model="mapping.key" aria-label="写入变量名" placeholder="orderStatus" />
                <span aria-hidden="true"> = rows[0].</span>
                <input v-model="mapping.value" aria-label="列名" placeholder="status" />
              </div>
              <div class="scenario-pre__mapping-actions">
                <button
                  v-if="activeRow.extractParams?.length !== 1 || mapping.key || mapping.value"
                  class="is-danger" type="button" aria-label="删除映射" title="删除映射" @click="removeMapping(activeRow, index)"
                ><Trash2 :size="12" /></button>
                <button
                  v-if="index === (activeRow.extractParams?.length ?? 0) - 1"
                  type="button" aria-label="添加列映射" title="添加列映射" @click="addMapping(activeRow)"
                ><Plus :size="12" /></button>
              </div>
            </div>
          </div>
          <p class="scenario-pre__hint">查询语句返回结果集，更新语句展示影响行数。</p>
        </template>

        <template v-else-if="activeRow.processorType === 'TIME_WAITING'">
          <label class="scenario-pre__field scenario-pre__wait">等待时长 (ms)
            <input class="scenario-pre__input" type="number" :value="activeRow.delayMs" min="1" max="600000" @change="updateNumber(activeRow, 'delayMs', $event)" />
          </label>
          <p class="scenario-pre__hint">范围 1–600000ms，默认 1000ms。</p>
        </template>

        <template v-else-if="stage === 'post' && activeRow.processorType === 'EXTRACT'">
          <template v-for="(rule, index) in activeRow.extractors" :key="rule.id || index">
            <div class="scenario-pre__field-pair">
              <label class="scenario-pre__field">提取范围
                <select v-model="rule.extractScope" class="scenario-pre__input" aria-label="提取范围">
                  <option v-if="rule.extractScope && !extractScopeOptions.some(({ value }) => value === rule.extractScope)" :value="rule.extractScope">
                    {{ processorRegexExtractScopeOptions.find(({ value }) => value === rule.extractScope)?.label || rule.extractScope }}
                  </option>
                  <option v-for="option in extractScopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="scenario-pre__field">提取方式
                <select v-model="rule.extractType" class="scenario-pre__input" aria-label="提取方式">
                  <option v-for="option in processorExtractTypeOptions" :key="option.value" :value="option.value">{{ option.value === 'REGEX' ? '正则' : option.label }}</option>
                </select>
              </label>
            </div>
            <label class="scenario-pre__field">变量名称
              <input v-model="rule.variableName" class="scenario-pre__input" placeholder="orderId" />
            </label>
            <label class="scenario-pre__field">提取表达式
              <input v-model="rule.expression" class="scenario-pre__input" :placeholder="extractPlaceholders[rule.extractType || 'JSON_PATH']" />
            </label>
          </template>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scenario-pre {
  display: grid;
  min-height: 330px;
  grid-template-columns: 230px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
}
.scenario-pre__sidebar { border-right: 1px solid #e5e6eb; background: #fafbfe; }
.scenario-pre__toolbar { padding: 8px; border-bottom: 1px solid #e5e6eb; }
.scenario-pre__toolbar :deep(.el-dropdown) { display: block; }
.scenario-pre__add {
  display: flex;
  width: 100%;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: #165dff;
  color: #fff;
  font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif;
}
.scenario-pre__toolbar :deep(.scenario-pre-menu) {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px rgb(0 0 0 / 10%);
}
.scenario-pre__toolbar :deep(.el-dropdown-menu) { padding: 4px; }
.scenario-pre__toolbar :deep(.el-dropdown-menu__item) { gap: 8px; padding: 8px 12px; border-radius: 8px; color: #1d2129; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.scenario-pre__toolbar :deep(.el-dropdown-menu__item:not(.is-disabled):is(:hover, :focus)) { background: oklch(0.985 0.002 247.839); color: #1d2129; }
.scenario-pre__rows { display: grid; gap: 4px; padding: 8px; }
.scenario-pre__row { position: relative; min-width: 0; padding: 8px; border-radius: 10px; }
.scenario-pre__row.is-active { background: #e8f3ff; }
.scenario-pre__select {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1d2129;
  font: inherit;
  font-weight: 500;
  text-align: left;
}
.scenario-pre__row.is-active .scenario-pre__select { color: #165dff; }
.scenario-pre__select::before { position: absolute; inset: 0; border-radius: inherit; content: ""; }
.scenario-pre__dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: #c9cdd4; }
.scenario-pre__dot.is-enabled { background: #00b42a; }
.scenario-pre__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scenario-pre__row-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.scenario-pre__row-actions button { position: relative; }
.scenario-pre__row-actions button, .scenario-pre__mapping button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #86909c;
}
.scenario-pre__row-actions button:not(:disabled):hover, .scenario-pre__mapping button:hover { background: #f2f3f5; }
.scenario-pre__row-actions .is-danger, .scenario-pre__mapping .is-danger { color: #f53f3f; }
.scenario-pre__row-actions .is-danger:hover, .scenario-pre__mapping .is-danger:hover { background: #ffeeee; }
.scenario-pre__sidebar-empty { padding: 48px 0; color: #c9cdd4; font-size: 11px; line-height: 16.5px; text-align: center; }
.scenario-pre__detail { display: flex; min-width: 0; flex-direction: column; padding: 16px; }
.scenario-pre__detail-empty { margin: auto; color: #c9cdd4; }
.scenario-pre__fields, .scenario-pre__field { display: grid; min-width: 0; gap: 12px; }
.scenario-pre__field { gap: 4px; color: #86909c; font-size: 11px; line-height: 16.5px; }
label.scenario-pre__field, .scenario-pre__mapping-title { font-weight: 500; }
.scenario-pre__heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 12px; }
.scenario-pre__enabled { display: flex; height: 32px; align-items: center; gap: 8px; color: #4e5969; font-size: 11px; }
.scenario-pre__input, .scenario-pre__mapping {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #1d2129;
  font: 400 12px/18px Inter, "Noto Sans SC", sans-serif;
}
.scenario-pre__input:focus, .scenario-pre__mapping:focus-within, .scenario-pre__code:focus { border-color: #165dff; outline: none; }
.scenario-pre__input[type="number"] { appearance: textfield; }
.scenario-pre__input::-webkit-inner-spin-button { appearance: none; }
.scenario-pre__info { margin: 0; padding: 10px; border-radius: 10px; background: #e8f3ff; color: #165dff; font-size: 11px; line-height: 16.5px; }
.scenario-pre__code {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 0;
  margin-bottom: 5px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #fff;
  color: #1d2129;
  font: 400 11px/16.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  resize: vertical;
}
.scenario-pre__code.is-script { min-height: 205.5px; border: 0; background: #101827; color: #dde7f4; }
.scenario-pre__code.is-script::placeholder { color: #86909c; }
.scenario-pre__code.is-script:focus-visible { outline: 1px solid #165dff; }
.scenario-pre__field-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.scenario-pre__datasource { width: 100%; }
.scenario-pre__datasource :deep(.el-select__wrapper) { min-height: 32px; padding: 0 9px; border-radius: 7px; box-shadow: 0 0 0 1px #e5e6eb inset; font-size: 12px; }
.scenario-pre__datasource :deep(.el-select__wrapper.is-focused) { box-shadow: 0 0 0 1px #165dff inset; }
.scenario-pre__datasource :deep(.el-select__caret) { color: #1d2129; }
.scenario-pre__mapping { display: flex; align-items: center; gap: 4px; }
.scenario-pre__mapping-expression { display: flex; flex: 1; min-width: 0; align-items: baseline; }
.scenario-pre__mapping-expression > input {
  width: 9ch;
  min-width: 3ch;
  max-width: 50%;
  padding: 3px 0;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
}
.scenario-pre__mapping-expression > input:focus-visible { box-shadow: 0 1px #165dff; }
.scenario-pre__mapping-expression > span { white-space: pre; }
.scenario-pre__mapping-expression:has(input:placeholder-shown) > span,
.scenario-pre__mapping-expression > input::placeholder { color: #757575; }
.scenario-pre__mapping-actions { display: flex; flex: none; }
.scenario-pre__mapping button:last-child:not(.is-danger) { color: #165dff; }
@supports (field-sizing: content) {
  .scenario-pre__mapping-expression > input { width: auto; field-sizing: content; }
}
@media (hover: hover) and (pointer: fine) {
  .scenario-pre__mapping:not(:hover, :focus-within) .scenario-pre__mapping-actions { opacity: 0; }
}
.scenario-pre__wait { max-width: 260px; }
.scenario-pre__hint { margin: 0; color: #c9cdd4; font-size: 10px; line-height: 15px; }
@media (max-width: 680px) {
  .scenario-pre { grid-template-columns: minmax(128px, 36%) minmax(0, 1fr); }
  .scenario-pre__detail { padding: 12px; }
  .scenario-pre__field-pair { grid-template-columns: minmax(0, 1fr); gap: 8px; }
}
</style>
