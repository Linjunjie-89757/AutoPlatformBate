<script setup lang="ts">
import type { ApiRunStepResult } from '@/entities/api-automation'

import ApiRunStepDetailViewer from './ApiRunStepDetailViewer.vue'

defineProps<{
  modelValue: boolean
  step: ApiRunStepResult | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="step?.stepName || '步骤明细'"
    size="960px"
    destroy-on-close
    append-to-body
    class="api-soft-drawer scenario-report-step-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="step" class="scenario-report-step-detail">
      <ApiRunStepDetailViewer :step="step" />
    </div>
  </el-drawer>
</template>
