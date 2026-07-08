<script setup lang="ts">
import { ref } from 'vue'
import { MagicStick, MoreFilled } from '@element-plus/icons-vue'
import type {
  ExtractorItem,
  ScenarioProcessor,
} from './lib/scenarioProcessorEditorTypes'
import {
  applyProcessorExtractorTypeDefaults,
  createEmptyProcessorExtractor,
  ensureProcessorExtractors,
  normalizeProcessorExtractorType,
  processorExtractScopeOptions,
} from './lib/scenarioProcessorEditorTypes'

const props = defineProps<{
  processor: ScenarioProcessor
  hasResponseBody: boolean
  fastExtractionTitle: string
}>()

const emit = defineEmits<{
  change: []
  fastExtract: [processor: ScenarioProcessor, index: number]
}>()

const moreSettingsVisibleKey = ref<string | null>(null)

function processorKey(processor: ScenarioProcessor | null) {
  return processor?.id || 'processor'
}

function extractors() {
  return ensureProcessorExtractors(props.processor)
}

function handleExtractorTypeChange(item: ExtractorItem) {
  applyProcessorExtractorTypeDefaults(item)
  emit('change')
}

function showSpecificResultIndex(item: ExtractorItem) {
  return (item.resultMatchingRule || 'RANDOM') === 'SPECIFIC'
}

function showRegexSettings(item: ExtractorItem) {
  return normalizeProcessorExtractorType(item) === 'REGEX'
}

function showXPathSettings(item: ExtractorItem) {
  return normalizeProcessorExtractorType(item) === 'X_PATH'
}

function setMoreSettingsVisible(processorId: string, index: number, visible: boolean) {
  moreSettingsVisibleKey.value = visible ? `${processorId}-${index}` : null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function addExtractor() {
  extractors().push(createEmptyProcessorExtractor())
  emit('change')
}

function copyExtractor(index: number) {
  const source = extractors()[index]
  if (!source) return
  extractors().splice(index + 1, 0, clone(source))
  emit('change')
}

function removeExtractor(index: number) {
  extractors().splice(index, 1)
  if (!extractors().length) {
    extractors().push(createEmptyProcessorExtractor())
  }
  emit('change')
}
</script>

<template>
  <div class="scenario-advanced-table scenario-extractor-table">
    <div class="scenario-advanced-table-head">
      <span>变量名</span>
      <span>描述</span>
      <span>变量类型</span>
      <span>提取方式</span>
      <span>提取范围</span>
      <span>表达式</span>
      <span></span>
    </div>
    <div v-for="(item, index) in extractors()" :key="`${processor.id}-extract-${index}`" class="scenario-advanced-table-row">
      <el-input v-model="item.variableName" placeholder="变量名" @input="emit('change')" />
      <el-input v-model="item.description" placeholder="描述" @input="emit('change')" />
      <el-select v-model="item.variableType" @change="emit('change')">
        <el-option label="临时变量" value="TEMPORARY" />
        <el-option label="环境变量" value="ENVIRONMENT" />
      </el-select>
      <el-select v-model="item.extractType" @change="handleExtractorTypeChange(item)">
        <el-option label="JSONPath" value="JSON_PATH" />
        <el-option label="XPath" value="X_PATH" />
        <el-option label="Regex" value="REGEX" />
      </el-select>
      <el-select v-model="item.extractScope" @change="emit('change')">
        <el-option v-for="option in processorExtractScopeOptions(item.extractType)" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-input v-model="item.expression" placeholder="表达式" @input="emit('change')">
        <template #suffix>
          <button
            type="button"
            :class="['scenario-fast-extract', { 'is-disabled': !hasResponseBody }]"
            :disabled="!hasResponseBody"
            :title="fastExtractionTitle"
            aria-label="快速提取"
            @click.stop="emit('fastExtract', processor, index)"
          >
            <el-icon><MagicStick /></el-icon>
          </button>
        </template>
      </el-input>
      <span class="scenario-extractor-actions">
        <el-popover
          placement="bottom-end"
          :width="340"
          trigger="click"
          :visible="moreSettingsVisibleKey === `${processorKey(processor)}-${index}`"
          @update:visible="(value: boolean) => setMoreSettingsVisible(processorKey(processor), index, value)"
        >
          <template #reference>
            <el-button text class="scenario-extractor-more-trigger" :icon="MoreFilled" />
          </template>

          <div class="scenario-extractor-more-settings">
            <button
              type="button"
              class="scenario-extractor-more-copy"
              @click="copyExtractor(index)"
            >
              复制当前提取项
            </button>

            <div class="scenario-extractor-more-divider"></div>
            <div class="scenario-extractor-more-title">高级设置</div>

            <div class="scenario-extractor-more-group">
              <div class="scenario-extractor-more-label">结果匹配规则</div>
              <el-radio-group v-model="item.resultMatchingRule" size="small" @change="emit('change')">
                <el-radio value="RANDOM">随机</el-radio>
                <el-radio value="SPECIFIC">指定</el-radio>
                <el-radio value="ALL">全部</el-radio>
              </el-radio-group>
            </div>

            <div v-if="showSpecificResultIndex(item)" class="scenario-extractor-more-group">
              <div class="scenario-extractor-more-label">指定序号</div>
              <el-input-number v-model="item.resultMatchingRuleNum" :min="1" :step="1" size="small" @change="emit('change')" />
            </div>

            <div v-if="showRegexSettings(item)" class="scenario-extractor-more-group">
              <div class="scenario-extractor-more-label">正则匹配规则</div>
              <el-radio-group v-model="item.expressionMatchingRule" size="small" @change="emit('change')">
                <el-radio value="EXPRESSION">整段匹配</el-radio>
                <el-radio value="GROUP">分组 1</el-radio>
              </el-radio-group>
            </div>

            <div v-if="showXPathSettings(item)" class="scenario-extractor-more-group">
              <div class="scenario-extractor-more-label">内容格式</div>
              <el-radio-group v-model="item.responseFormat" size="small" @change="emit('change')">
                <el-radio value="XML">XML</el-radio>
                <el-radio value="HTML">HTML</el-radio>
              </el-radio-group>
            </div>
          </div>
        </el-popover>
        <button type="button" class="scenario-row-remove" @click="removeExtractor(index)">删除</button>
      </span>
    </div>
    <button type="button" class="scenario-advanced-add-row" @click="addExtractor">+ 添加提取项</button>
  </div>
</template>
