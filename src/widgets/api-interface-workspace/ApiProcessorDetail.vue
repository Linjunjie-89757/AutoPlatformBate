<script setup lang="ts">
import { Delete, MoreFilled } from '@element-plus/icons-vue'
import { computed, nextTick, ref, watch } from 'vue'
import { Database, Plus, Sparkles } from '@lucide/vue'

import processorEmptyRightIcon from '@/assets/figma-processor/processor-empty-left.svg'

import { AppSwitch } from '@/shared/ui'

import ApiCodeEditor from './ApiCodeEditor.vue'
import type {
  ApiProcessorExtractItemRow,
  ApiProcessorOption,
  ApiProcessorPanelRow,
  ApiProcessorSqlExtractParamRow,
} from './apiProcessorTypes'

const props = defineProps<{
  stage: 'pre' | 'post'
  activeProcessor: ApiProcessorPanelRow | null
  extractVariableTypeOptions: ApiProcessorOption[]
  extractTypeOptions: ApiProcessorOption[]
  hasLatestResponseBody: boolean
  fastExtractionTitle: string
  moreSettingsVisibleKey: string | null
  normalizeSqlExtractParams: (items: ApiProcessorSqlExtractParamRow[] | undefined) => ApiProcessorSqlExtractParamRow[]
  normalizeProcessorExtractItems: (items: ApiProcessorExtractItemRow[] | undefined, processor: ApiProcessorPanelRow) => ApiProcessorExtractItemRow[]
  processorExtractScopeOptions: (item: ApiProcessorExtractItemRow) => ApiProcessorOption[]
  processorExtractExpressionPlaceholder: (item: ApiProcessorExtractItemRow) => string
  showProcessorExtractSpecificIndex: (item: ApiProcessorExtractItemRow) => boolean
  showProcessorExtractRegexSettings: (item: ApiProcessorExtractItemRow) => boolean
  showProcessorExtractXpathSettings: (item: ApiProcessorExtractItemRow) => boolean
}>()

const emit = defineEmits<{
  copy: []
  remove: []
  syncScript: [processor: ApiProcessorPanelRow]
  addSqlExtractParam: [processor: ApiProcessorPanelRow]
  removeSqlExtractParam: [processor: ApiProcessorPanelRow, index: number]
  addExtractItem: [processor: ApiProcessorPanelRow]
  copyExtractItem: [processor: ApiProcessorPanelRow, index: number]
  removeExtractItem: [processor: ApiProcessorPanelRow, index: number]
  extractTypeChange: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  extractScopeChange: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  setMoreSettingsVisible: [processorId: string | undefined, index: number, visible: boolean]
  openFastExtraction: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  dirty: []
}>()

const detailRef = ref<HTMLElement | null>(null)

function toggleProcessor() {
  if (!props.activeProcessor) return
  props.activeProcessor.enabled = !props.activeProcessor.enabled
  emit('dirty')
}

function setMoreSettingsVisible(index: number, visible: boolean) {
  emit('setMoreSettingsVisible', props.activeProcessor?.id, index, visible)
}

const waitPresets = [500, 1000, 2000, 5000] as const

function setWaitDelay(delayMs: number) {
  if (!props.activeProcessor) return
  props.activeProcessor.delayMs = delayMs
  emit('dirty')
}

function updateWaitDelay(event: Event) {
  const input = event.target as HTMLInputElement
  const parsedDelay = Number(input.value)
  const delayMs = Number.isFinite(parsedDelay)
    ? Math.min(600000, Math.max(1, parsedDelay))
    : 1
  setWaitDelay(delayMs)
}

function waitPresetLabel(delayMs: number) {
  return delayMs >= 1000 ? `${delayMs / 1000}s` : `${delayMs}ms`
}

const scriptApis = computed(() => props.stage === 'pre'
  ? [
      ['setVar(name,val)', '写入变量'],
      ['getVar(name)', '读取变量'],
      ['log(msg)', '输出日志'],
      ['fail(msg)', '主动失败'],
      ['request.headers', '修改请求头'],
      ['request.query', '修改 Query'],
      ['request.body', '修改 Body'],
    ]
  : [
      ['response.status', '响应状态码'],
      ['response.body', '响应体对象'],
      ['response.headers', '响应头'],
      ['setVar(name,val)', '写入变量'],
      ['getVar(name)', '读取变量'],
      ['log(msg)', '输出日志'],
      ['fail(msg)', '主动失败'],
    ])

const descriptionPlaceholder = computed(() => {
  if (props.activeProcessor?.processorType !== 'TIME_WAITING') return '描述此处理器的用途'
  return props.stage === 'pre' ? '描述等待原因，如：等待任务队列初始化' : '描述等待原因'
})

const detailClasses = computed(() => {
  const processorType = props.activeProcessor?.processorType
    ?.toLowerCase()
    .replaceAll('_', '-')

  return [
    'api-processor-detail',
    `is-${props.stage}`,
    processorType ? `is-${processorType}` : 'is-empty',
  ]
})

watch(
  () => props.activeProcessor?.id,
  async () => {
    await nextTick()
    detailRef.value?.scrollTo({ top: 0 })
  },
)
</script>

<template>
  <section ref="detailRef" :class="detailClasses">
    <template v-if="activeProcessor">
      <div class="api-processor-name-row">
        <label class="api-figma-field api-figma-field--fluid">
          <span>处理器名称</span>
          <el-input v-model="activeProcessor.name" placeholder="处理器名称" @input="emit('dirty')" />
        </label>
        <div class="api-processor-name-actions">
          <button type="button" @click="emit('copy')">复制</button>
          <button type="button" class="api-row-remove" @click="emit('remove')">删除</button>
        </div>
        <label class="api-figma-enable">
          <AppSwitch
            :model-value="activeProcessor.enabled !== false"
            :label="activeProcessor.enabled === false ? '启用处理器' : '停用处理器'"
            @update:model-value="toggleProcessor"
          />
          <em>启用</em>
        </label>
      </div>

      <template v-if="activeProcessor.processorType === 'SCRIPT'">
        <div class="api-processor-script-head">
          <span>脚本内容</span>
          <div class="api-processor-script-actions">
            <button type="button" @click="activeProcessor.script = ''; emit('dirty')">清空</button>
            <button type="button" @click="activeProcessor.script = (activeProcessor.script || '').trim(); emit('dirty')">格式化</button>
          </div>
        </div>
        <ApiCodeEditor
          v-model="activeProcessor.script"
          height="253px"
          language="javascript"
          placeholder="请输入 JavaScript 脚本"
          :show-format-button="false"
          theme-variant="dark"
          :font-size="12"
          :line-height="19.5"
          :padding-top="10.5"
          :padding-bottom="10.5"
          @change="emit('dirty')"
        >
          <template #toolbar>
            <span class="api-processor-language-tag">JavaScript</span>
            <span class="api-processor-api-chip">setVar / getVar / request / response / log / fail</span>
          </template>
        </ApiCodeEditor>
        <div class="api-processor-api-card">
          <div class="api-processor-api-card__title">可用 API</div>
          <div class="api-processor-api-card__items">
            <span v-for="([api, description], index) in scriptApis" :key="`${api}-${index}`" class="api-processor-api-card__item">
              <code>{{ api }}</code>
              <small>{{ description }}</small>
            </span>
          </div>
        </div>
      </template>

      <template v-else-if="activeProcessor.processorType === 'SQL'">
        <div class="api-processor-form-grid">
          <label><span>数据源</span><div class="api-processor-datasource"><Database :size="13" aria-hidden="true" /><el-select v-model="activeProcessor.dataSourceName" filterable clearable allow-create default-first-option placeholder="选择数据库连接" @change="emit('dirty')" /></div></label>
          <label><span>查询超时 (ms)</span><input v-model.number="activeProcessor.queryTimeout" class="api-processor-sql-timeout" type="number" min="100" max="60000" step="100" @change="emit('dirty')" /></label>
        </div>
        <div class="api-processor-sql-label"><span>查询语句</span><small>仅支持 SELECT</small></div>
        <ApiCodeEditor
          v-model="activeProcessor.sql"
          height="153px"
          language="sql"
          placeholder="请输入 SQL 语句"
          :show-format-button="false"
          theme-variant="dark"
          :font-size="12"
          :line-height="19.5"
          :padding-top="10.5"
          :padding-bottom="10.5"
          @change="emit('syncScript', activeProcessor)"
        >
          <template #toolbar>
            <Database class="api-processor-sql-toolbar-icon" :size="11" aria-hidden="true" />
            <span class="api-processor-language-tag">SQL</span>
          </template>
        </ApiCodeEditor>
        <div class="api-sql-extract-heading">
          <span>列 → 变量映射</span>
          <button type="button" @click="emit('addSqlExtractParam', activeProcessor)">
            <Plus :size="12" aria-hidden="true" />
            <span>添加列</span>
          </button>
        </div>
        <div class="api-sql-extract-table">
          <div class="api-sql-extract-table__header">
            <span>{{ stage === 'pre' ? '变量名' : '列名' }}</span>
            <span>{{ stage === 'pre' ? '列名' : '写入变量名' }}</span>
            <span>操作</span>
          </div>
          <div v-for="(param, sqlParamIndex) in normalizeSqlExtractParams(activeProcessor.extractParams)" :key="`${activeProcessor.id}-sql-${sqlParamIndex}`" class="api-sql-extract-table__row">
            <input v-if="stage === 'pre'" v-model="param.key" class="api-sql-extract-native-input api-sql-extract-input--variable" placeholder="变量名" @input="emit('dirty')" />
            <input v-else v-model="param.value" class="api-sql-extract-native-input api-sql-extract-input--column" placeholder="列名" @input="emit('dirty')" />
            <input v-if="stage === 'pre'" v-model="param.value" class="api-sql-extract-native-input api-sql-extract-input--column" placeholder="列名" @input="emit('dirty')" />
            <input v-else v-model="param.key" class="api-sql-extract-native-input api-sql-extract-input--variable" placeholder="变量名" @input="emit('dirty')" />
            <button type="button" class="api-row-remove api-sql-extract-table__delete" aria-label="删除" title="删除" @click="emit('removeSqlExtractParam', activeProcessor, sqlParamIndex)"><el-icon><Delete /></el-icon></button>
          </div>
          <div v-if="!normalizeSqlExtractParams(activeProcessor.extractParams).length" class="api-sql-extract-table__empty">
            {{ stage === 'pre' ? '暂无提取列' : '暂无映射，查询结果将不写入变量' }}
          </div>
        </div>
        <label class="api-figma-field api-processor-sql-result">
          <span>完整结果变量（选填）</span>
          <el-input v-model="activeProcessor.resultVariable" placeholder="将查询结果数组整体存入此变量" @input="emit('dirty')" />
        </label>
      </template>

      <template v-else-if="activeProcessor.processorType === 'EXTRACT'">
        <div class="api-processor-extract-panel">
          <div class="api-processor-extract-toolbar">
            <span>提取参数</span>
            <button type="button" @click="emit('addExtractItem', activeProcessor)">
              <Plus :size="12" aria-hidden="true" />
              <span>添加提取项</span>
            </button>
          </div>
          <div class="api-processor-extract-scroll">
            <div class="api-processor-extract-grid">
              <div class="api-processor-extract-header"><span>变量名</span><span>描述</span><span>变量类型</span><span>提取方式</span><span>提取范围</span><span>表达式</span><span>操作</span></div>
              <div v-for="(item, extractIndex) in normalizeProcessorExtractItems(activeProcessor.extractors, activeProcessor)" :key="item.id || extractIndex" class="api-processor-extract-row">
                <el-input v-model="item.variableName" placeholder="例如 token" @input="emit('syncScript', activeProcessor)" />
                <el-input v-model="item.description" placeholder="可选" @input="emit('syncScript', activeProcessor)" />
                <el-select v-model="item.variableType" @change="emit('syncScript', activeProcessor)"><el-option v-for="option in extractVariableTypeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                <el-select v-model="item.extractType" @change="emit('extractTypeChange', activeProcessor, item)"><el-option v-for="option in extractTypeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                <el-select v-model="item.extractScope" :disabled="item.extractType !== 'REGEX'" @change="emit('extractScopeChange', activeProcessor, item)"><el-option v-for="option in processorExtractScopeOptions(item)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                <el-input v-model="item.expression" :placeholder="processorExtractExpressionPlaceholder(item)" @input="emit('syncScript', activeProcessor)">
                  <template #suffix>
                    <button type="button" :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]" :disabled="!hasLatestResponseBody" :title="fastExtractionTitle" @click.stop="emit('openFastExtraction', activeProcessor, item)">
                      <Sparkles :size="11" aria-hidden="true" />
                    </button>
                  </template>
                </el-input>
                <span class="api-processor-extract-actions">
                  <el-popover placement="bottom-end" :width="220" trigger="click" popper-class="api-processor-extract-more-popper" :visible="moreSettingsVisibleKey === `${activeProcessor?.id || ''}-${extractIndex}`" @update:visible="setMoreSettingsVisible(extractIndex, $event)">
                    <template #reference><button type="button" class="api-processor-extract-more" aria-label="更多设置"><el-icon><MoreFilled /></el-icon></button></template>
                    <div class="api-processor-extract-more-panel">
                      <button type="button" class="api-processor-extract-copy" @click="emit('copyExtractItem', activeProcessor, extractIndex)">复制当前提取项</button>
                      <div class="api-processor-extract-more-divider"></div>
                      <div class="api-processor-extract-more-title">高级设置</div>
                      <div class="api-processor-extract-more-group">
                        <div class="api-processor-extract-more-label">结果匹配规则</div>
                        <el-radio-group v-model="item.resultMatchingRule" size="small" @change="emit('syncScript', activeProcessor)">
                          <el-radio value="RANDOM">随机</el-radio>
                          <el-radio value="SPECIFIC">指定</el-radio>
                          <el-radio value="ALL">全部</el-radio>
                        </el-radio-group>
                        <div v-if="showProcessorExtractSpecificIndex(item)" class="api-processor-extract-more-index">
                          <input v-model.number="item.resultMatchingRuleNum" type="number" min="1" @change="emit('syncScript', activeProcessor)" />
                        </div>
                      </div>
                      <label v-if="showProcessorExtractRegexSettings(item)" class="api-processor-extract-more-select">
                        <span>Regex 分组</span>
                        <select v-model="item.expressionMatchingRule" @change="emit('syncScript', activeProcessor)">
                          <option value="EXPRESSION">整段匹配</option>
                          <option value="GROUP">分组 1</option>
                        </select>
                      </label>
                      <label v-if="showProcessorExtractXpathSettings(item)" class="api-processor-extract-more-select">
                        <span>内容格式</span>
                        <select v-model="item.responseFormat" @change="emit('syncScript', activeProcessor)">
                          <option value="XML">XML</option>
                          <option value="HTML">HTML</option>
                        </select>
                      </label>
                    </div>
                  </el-popover>
                  <button type="button" class="api-row-remove api-processor-extract-delete" aria-label="删除提取项" title="删除" @click="emit('removeExtractItem', activeProcessor, extractIndex)"><el-icon><Delete /></el-icon></button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="activeProcessor.processorType === 'TIME_WAITING'">
        <div class="api-processor-wait">
          <span class="api-processor-wait__label">等待时长</span>
          <div class="api-processor-wait__input-row">
            <input
              class="api-processor-wait__input"
              type="number"
              :value="activeProcessor.delayMs"
              min="1"
              max="600000"
              @input="updateWaitDelay"
            />
            <span class="api-processor-wait__unit">毫秒 (ms)</span>
          </div>
          <div class="api-processor-wait__presets">
            <button
              v-for="delayMs in waitPresets"
              :key="delayMs"
              type="button"
              :class="{ 'is-active': activeProcessor.delayMs === delayMs }"
              @click="setWaitDelay(delayMs)"
            >
              {{ waitPresetLabel(delayMs) }}
            </button>
          </div>
          <p class="api-processor-wait__hint">最长 600,000 ms（10 分钟）</p>
        </div>
      </template>

      <label class="api-figma-field">
        <span>说明（选填）</span>
        <el-input v-model="activeProcessor.description" :placeholder="descriptionPlaceholder" @input="emit('dirty')" />
      </label>
    </template>
    <div v-else class="api-processor-empty api-processor-empty--inline">
      <img class="api-processor-empty-icon" :src="processorEmptyRightIcon" alt="" aria-hidden="true" />
      <span>选择左侧处理器进行编辑</span>
    </div>
  </section>
</template>
