<script setup lang="ts">
import { MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type {
  AssertionExpressionType,
  AssertionItem,
  ScenarioAssertion,
} from './lib/scenarioAssertionEditorTypes'
import {
  assertionBodyGroup,
  assertionBodyItems,
  assertionConditionOptions,
  bodyExpressionOptions,
  cloneAssertionValue,
  ensureAssertionGroupShape,
  normalizeAssertionBodyType,
} from './lib/scenarioAssertionEditorTypes'

const props = defineProps<{
  assertion: ScenarioAssertion
  hasResponseBody: boolean
  fastExtractionTitle: string
  latestResponseBody?: string
}>()

const emit = defineEmits<{
  change: []
  fastExtract: [index: number]
}>()

function bodyGroup() {
  return assertionBodyGroup(props.assertion)
}

function bodyItems() {
  return assertionBodyItems(props.assertion)
}

function setBodyExpressionType(type: AssertionExpressionType) {
  props.assertion.assertionBodyType = type
  ensureAssertionGroupShape(props.assertion, 'jsonPathAssertion', 'JSON_PATH')
  ensureAssertionGroupShape(props.assertion, 'xpathAssertion', 'X_PATH')
  ensureAssertionGroupShape(props.assertion, 'regexAssertion', 'REGEX')
  emit('change')
}

function addBodyItem() {
  bodyItems().push({ expression: '', condition: 'EQUALS', expectedValue: '' })
  emit('change')
}

function duplicateAssertionItem(items: AssertionItem[], index: number) {
  const source = items[index]
  if (!source) return
  items.splice(index + 1, 0, cloneAssertionValue(source))
  emit('change')
}

function removeAssertionItem(items: AssertionItem[], index: number) {
  items.splice(index, 1)
  if (!items.length) {
    items.push({ enabled: true, condition: 'EQUALS', expectedValue: '' })
  }
  emit('change')
}

function testBodyExpression(item: AssertionItem) {
  if (!props.latestResponseBody?.trim()) {
    ElMessage.warning('请先发送请求获取响应内容')
    return
  }
  if (!item.expression?.trim()) {
    ElMessage.warning('请先填写表达式')
    return
  }
  ElMessage.info('场景步骤内表达式测试会在调试响应后回填验证结果')
}
</script>

<template>
  <div class="scenario-expression-switch">
    <button
      v-for="option in bodyExpressionOptions"
      :key="option.value"
      type="button"
      :class="{ active: normalizeAssertionBodyType(assertion.assertionBodyType) === option.value }"
      @click="setBodyExpressionType(option.value)"
    >
      {{ option.label }}
    </button>
    <el-select
      v-if="normalizeAssertionBodyType(assertion.assertionBodyType) === 'X_PATH'"
      v-model="bodyGroup().responseFormat"
      class="scenario-assertion-format-select"
      @change="emit('change')"
    >
      <el-option label="XML" value="XML" />
      <el-option label="HTML" value="HTML" />
    </el-select>
  </div>
  <div class="scenario-advanced-table scenario-assertion-body-table">
    <div class="scenario-advanced-table-head">
      <span></span>
      <span>表达式</span>
      <span>条件</span>
      <span>期望值</span>
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div v-for="(item, index) in bodyItems()" :key="`${assertion.id}-body-${index}`" class="scenario-advanced-table-row">
      <el-checkbox v-model="item.enabled" @change="emit('change')" />
      <el-input v-model="item.expression" placeholder="$.data.id" @input="emit('change')">
        <template #suffix>
          <button
            type="button"
            :class="['scenario-fast-extract', { 'is-disabled': !hasResponseBody }]"
            :disabled="!hasResponseBody"
            :title="fastExtractionTitle"
            aria-label="快速提取"
            @click.stop="emit('fastExtract', index)"
          >
            <el-icon><MagicStick /></el-icon>
          </button>
        </template>
      </el-input>
      <el-select v-model="item.condition" @change="emit('change')">
        <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-input v-model="item.expectedValue" placeholder="期望值" @input="emit('change')" />
      <button type="button" class="scenario-row-action" @click="testBodyExpression(item)">测试</button>
      <button type="button" class="scenario-row-action" @click="duplicateAssertionItem(bodyItems(), index)">复制</button>
      <button type="button" class="scenario-row-remove" @click="removeAssertionItem(bodyItems(), index)">删除</button>
    </div>
    <button type="button" class="scenario-advanced-add-row" @click="addBodyItem">+ 添加响应体断言</button>
  </div>
</template>
