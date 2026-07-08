<script setup lang="ts">
import type { ScenarioProcessor } from './lib/scenarioProcessorEditorTypes'

defineProps<{
  processor: ScenarioProcessor
}>()

const emit = defineEmits<{
  change: []
}>()
</script>

<template>
  <label class="scenario-advanced-field">
    <span>等待时长(ms)</span>
    <el-input-number v-model="processor.delayMs" :min="1" :max="60000" :step="100" @change="emit('change')" />
  </label>
</template>
