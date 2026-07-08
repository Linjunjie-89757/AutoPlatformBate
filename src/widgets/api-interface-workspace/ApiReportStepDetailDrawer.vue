<script setup lang="ts">
import { computed } from 'vue'
import type { ApiRunStepResult } from '@/entities/api-automation'
import ApiRunStepDetailViewer from '@/widgets/api-scenario-workspace/ApiRunStepDetailViewer.vue'

const props = defineProps<{
  modelValue: boolean
  step: ApiRunStepResult | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="step?.stepName || '接口详情'"
    size="960px"
    destroy-on-close
    append-to-body
    class="api-soft-drawer api-report-step-detail-drawer"
  >
    <div v-if="step" class="api-report-step-detail-drawer__body">
      <ApiRunStepDetailViewer :step="step" />
    </div>
  </el-drawer>
</template>

<style scoped>
.api-report-step-detail-drawer__body {
  display: flex;
  height: calc(100vh - 52px);
  min-height: 0;
  flex-direction: column;
  padding: 16px 18px 20px;
  box-sizing: border-box;
}
</style>
