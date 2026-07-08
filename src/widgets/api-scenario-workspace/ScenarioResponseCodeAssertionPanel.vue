<script setup lang="ts">
import type { ScenarioAssertion } from './lib/scenarioAssertionEditorTypes'
import { assertionConditionOptions } from './lib/scenarioAssertionEditorTypes'

defineProps<{
  assertion: ScenarioAssertion
}>()

const emit = defineEmits<{
  change: []
}>()
</script>

<template>
  <label class="scenario-advanced-field">
    <span>条件</span>
    <el-select v-model="assertion.condition" @change="emit('change')">
      <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
  </label>
  <label class="scenario-advanced-field">
    <span>期望值</span>
    <el-input v-model="assertion.expectedValue" placeholder="200" @input="emit('change')" />
  </label>
</template>
