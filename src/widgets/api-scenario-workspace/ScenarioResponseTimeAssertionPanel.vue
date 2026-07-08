<script setup lang="ts">
import type { ScenarioAssertion } from './lib/scenarioAssertionEditorTypes'

defineProps<{
  assertion: ScenarioAssertion
}>()

const emit = defineEmits<{
  change: []
}>()
</script>

<template>
  <label class="scenario-advanced-field">
    <span>最大耗时(ms)</span>
    <el-input-number v-model="assertion.expectedValue" :min="0" :step="100" @change="emit('change')" />
  </label>
</template>
