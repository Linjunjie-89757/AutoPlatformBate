<script setup lang="ts">
import type {
  AssertionItem,
  ScenarioAssertion,
} from './lib/scenarioAssertionEditorTypes'
import {
  assertionConditionOptions,
  assertionHeaderItems,
  cloneAssertionValue,
} from './lib/scenarioAssertionEditorTypes'

const props = defineProps<{
  assertion: ScenarioAssertion
}>()

const emit = defineEmits<{
  change: []
}>()

function headerItems() {
  return assertionHeaderItems(props.assertion)
}

function addHeaderItem() {
  headerItems().push({ enabled: true, header: '', condition: 'EQUALS', expectedValue: '' })
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
  <div class="scenario-advanced-table scenario-assertion-header-table">
    <div class="scenario-advanced-table-head">
      <span></span>
      <span>响应头名称</span>
      <span>条件</span>
      <span>期望值</span>
      <span></span>
      <span></span>
    </div>
    <div v-for="(item, index) in headerItems()" :key="`${assertion.id}-header-${index}`" class="scenario-advanced-table-row">
      <el-checkbox v-model="item.enabled" @change="emit('change')" />
      <el-input v-model="item.header" placeholder="Content-Type" @input="emit('change')" />
      <el-select v-model="item.condition" @change="emit('change')">
        <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-input v-model="item.expectedValue" placeholder="application/json" @input="emit('change')" />
      <button type="button" class="scenario-row-action" @click="duplicateAssertionItem(headerItems(), index)">复制</button>
      <button type="button" class="scenario-row-remove" @click="removeAssertionItem(headerItems(), index)">删除</button>
    </div>
    <button type="button" class="scenario-advanced-add-row" @click="addHeaderItem">+ 添加响应头断言</button>
  </div>
</template>
