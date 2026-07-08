<script setup lang="ts">
import type {
  AssertionItem,
  ScenarioAssertion,
} from './lib/scenarioAssertionEditorTypes'
import {
  assertionConditionOptions,
  assertionVariableItems,
  cloneAssertionValue,
} from './lib/scenarioAssertionEditorTypes'

const props = defineProps<{
  assertion: ScenarioAssertion
}>()

const emit = defineEmits<{
  change: []
}>()

function variableItems() {
  return assertionVariableItems(props.assertion)
}

function addVariableItem() {
  variableItems().push({ enabled: true, variableName: '', condition: 'EQUALS', expectedValue: '' })
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
</script>

<template>
  <div class="scenario-advanced-hint">可校验后置 SQL 或提取处理器写入的变量。</div>
  <div class="scenario-advanced-table scenario-assertion-variable-table">
    <div class="scenario-advanced-table-head">
      <span></span>
      <span>变量名</span>
      <span>条件</span>
      <span>期望值</span>
      <span></span>
      <span></span>
    </div>
    <div v-for="(item, index) in variableItems()" :key="`${assertion.id}-variable-${index}`" class="scenario-advanced-table-row">
      <el-checkbox v-model="item.enabled" @change="emit('change')" />
      <el-input v-model="item.variableName" placeholder="变量名" @input="emit('change')" />
      <el-select v-model="item.condition" @change="emit('change')">
        <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-input v-model="item.expectedValue" placeholder="期望值" @input="emit('change')" />
      <button type="button" class="scenario-row-action" @click="duplicateAssertionItem(variableItems(), index)">复制</button>
      <button type="button" class="scenario-row-remove" @click="removeAssertionItem(variableItems(), index)">删除</button>
    </div>
    <button type="button" class="scenario-advanced-add-row" @click="addVariableItem">+ 添加变量断言</button>
  </div>
</template>
