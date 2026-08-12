<script setup lang="ts">
import { MagicStick, MoreFilled } from '@element-plus/icons-vue'

import ApiCodeEditor from './ApiCodeEditor.vue'
import type {
  ApiProcessorExtractItemRow,
  ApiProcessorOption,
  ApiProcessorPanelRow,
  ApiProcessorSqlExtractParamRow,
} from './apiProcessorTypes'

const props = defineProps<{
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

function toggleProcessor() {
  if (!props.activeProcessor) return
  props.activeProcessor.enabled = !props.activeProcessor.enabled
  emit('dirty')
}

function setMoreSettingsVisible(index: number, visible: boolean) {
  emit('setMoreSettingsVisible', props.activeProcessor?.id, index, visible)
}
</script>

<template>
  <section class="api-processor-detail">
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
          <span
            :class="['api-figma-switch', { 'is-on': activeProcessor.enabled !== false }]"
            role="switch"
            :aria-checked="activeProcessor.enabled !== false"
            @click="toggleProcessor"
          >
            <span></span>
          </span>
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
          @change="emit('dirty')"
        >
          <template #toolbar>
            <span class="api-processor-language-tag">JavaScript</span>
            <span class="api-processor-api-chip">setVar / getVar / request / response / log / fail</span>
          </template>
        </ApiCodeEditor>
        <div class="api-processor-hint">可使用 setVar / getVar / removeVar / log / fail / request / response。</div>
      </template>

      <template v-else-if="activeProcessor.processorType === 'SQL'">
        <div class="api-processor-form-grid">
          <label><span>数据库连接</span><el-select v-model="activeProcessor.dataSourceName" filterable clearable allow-create default-first-option placeholder="选择数据库连接" @change="emit('dirty')" /></label>
          <label><span>查询超时(ms)</span><el-input-number v-model="activeProcessor.queryTimeout" :min="1000" :step="1000" @change="emit('dirty')" /></label>
          <label><span>按列存储变量</span><el-input v-model="activeProcessor.variableNames" placeholder="id,email" @input="emit('dirty')" /></label>
          <label><span>完整结果变量</span><el-input v-model="activeProcessor.resultVariable" placeholder="resultJson" @input="emit('dirty')" /></label>
        </div>
        <ApiCodeEditor
          v-model="activeProcessor.sql"
          height="253px"
          language="sql"
          placeholder="请输入 SQL 语句"
          :show-format-button="false"
          theme-variant="dark"
          @change="emit('syncScript', activeProcessor)"
        >
          <template #toolbar><span class="api-processor-language-tag">SQL</span></template>
        </ApiCodeEditor>
        <div class="api-sql-extract-table">
          <div class="api-sql-extract-table__header"><span>变量名</span><span>列名</span><span></span></div>
          <div v-for="(param, sqlParamIndex) in normalizeSqlExtractParams(activeProcessor.extractParams)" :key="`${activeProcessor.id}-sql-${sqlParamIndex}`" class="api-sql-extract-table__row">
            <el-input v-model="param.key" placeholder="变量名" @input="emit('dirty')" />
            <el-input v-model="param.value" placeholder="列名" @input="emit('dirty')" />
            <button type="button" class="api-row-remove" @click="emit('removeSqlExtractParam', activeProcessor, sqlParamIndex)">删除</button>
          </div>
          <button type="button" class="api-sql-extract-table__add" @click="emit('addSqlExtractParam', activeProcessor)">+ 添加提取参数</button>
        </div>
      </template>

      <template v-else-if="activeProcessor.processorType === 'EXTRACT'">
        <div class="api-processor-extract-panel">
          <div class="api-processor-extract-toolbar"><span>提取参数</span><button type="button" @click="emit('addExtractItem', activeProcessor)">+ 添加提取项</button></div>
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
                      <el-icon><MagicStick /></el-icon>
                    </button>
                  </template>
                </el-input>
                <span class="api-processor-extract-actions">
                  <el-popover placement="bottom-end" :width="340" trigger="click" :visible="moreSettingsVisibleKey === `${activeProcessor?.id || ''}-${extractIndex}`" @update:visible="setMoreSettingsVisible(extractIndex, $event)">
                    <template #reference><button type="button" class="api-processor-extract-more" aria-label="更多设置"><el-icon><MoreFilled /></el-icon></button></template>
                    <div class="api-processor-extract-more-panel">
                      <button type="button" class="api-processor-extract-copy" @click="emit('copyExtractItem', activeProcessor, extractIndex)">复制当前提取项</button>
                      <div class="api-processor-extract-more-divider"></div>
                      <div class="api-processor-extract-more-title">高级设置</div>
                      <div class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">结果匹配规则</div><el-radio-group v-model="item.resultMatchingRule" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="RANDOM">随机</el-radio><el-radio value="SPECIFIC">指定</el-radio><el-radio value="ALL">全部</el-radio></el-radio-group></div>
                      <div v-if="showProcessorExtractSpecificIndex(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">指定序号</div><el-input-number v-model="item.resultMatchingRuleNum" :min="1" :step="1" size="small" @change="emit('syncScript', activeProcessor)" /></div>
                      <div v-if="showProcessorExtractRegexSettings(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">正则匹配规则</div><el-radio-group v-model="item.expressionMatchingRule" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="EXPRESSION">整段匹配</el-radio><el-radio value="GROUP">分组 1</el-radio></el-radio-group></div>
                      <div v-if="showProcessorExtractXpathSettings(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">内容格式</div><el-radio-group v-model="item.responseFormat" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="XML">XML</el-radio><el-radio value="HTML">HTML</el-radio></el-radio-group></div>
                    </div>
                  </el-popover>
                  <button type="button" class="api-row-remove api-processor-extract-delete" aria-label="删除提取项" @click="emit('removeExtractItem', activeProcessor, extractIndex)">删除</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="api-processor-form-row"><span class="api-processor-form-label">等待时长(ms)</span><el-input-number v-model="activeProcessor.delayMs" :min="1" :max="600000" :step="100" @change="emit('dirty')" /></div>
      </template>

      <label class="api-figma-field">
        <span>说明</span>
        <el-input v-model="activeProcessor.description" placeholder="选填" @input="emit('dirty')" />
      </label>
    </template>
    <div v-else class="api-processor-empty api-processor-empty--inline">请选择一个处理器进行编辑</div>
  </section>
</template>
