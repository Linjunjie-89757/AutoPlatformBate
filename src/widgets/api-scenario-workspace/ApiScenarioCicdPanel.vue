<script setup lang="ts">
defineProps<{
  scenarioId: number | string
}>()
</script>

<template>
  <div class="scenario-placeholder-panel">
    <div class="scenario-cicd-panel">
      <strong>CI/CD</strong>
      <p>后续将提供命令、CI token、Webhook 和流水线参数配置。本期先保留基础占位，不伪造已完成能力。</p>
      <div class="scenario-cicd-command">
        <span>命令示例</span>
        <code>api-automation run scenario --id {{ scenarioId || 'SCENARIO_ID' }}</code>
      </div>
    </div>
  </div>
</template>
