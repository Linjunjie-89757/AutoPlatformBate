<script setup lang="ts">
import type { ApiScenarioRunHistoryItem } from '@/entities/api-automation'

defineProps<{
  loading: boolean
  items: ApiScenarioRunHistoryItem[]
  selectedId: number | null
  scenarioRunResultTone: (result?: string | null) => string
  scenarioRunResultLabel: (result?: string | null) => string
  formatScenarioDateTime: (value?: string | null) => string
}>()

const emit = defineEmits<{
  openReport: [id: number, workspaceCode?: string | null]
}>()
</script>

<template>
  <div v-loading="loading" class="scenario-placeholder-panel">
    <div class="scenario-run-history-head">
      <div>
        <span class="scenario-run-history-title">测试报告</span>
        <small>最近 10 次场景运行结果，点击后在新标签查看步骤明细</small>
      </div>
    </div>
    <div class="scenario-run-history-list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        :class="['scenario-run-history-item', { active: selectedId === item.id }]"
        @click="emit('openReport', item.id, item.workspaceCode)"
      >
        <span :class="['scenario-run-result-pill', `is-${scenarioRunResultTone(item.result)}`]">
          {{ scenarioRunResultLabel(item.result) }}
        </span>
        <span class="scenario-run-history-item-main">
          <strong>{{ item.scenarioName }}</strong>
          <small>{{ formatScenarioDateTime(item.createdAt) }} · {{ item.testDatasetName || '未使用测试数据' }}</small>
        </span>
        <el-tag v-if="item.operatorName === 'Local Runner'" size="small" effect="light" type="primary">本地执行器</el-tag>
        <span class="scenario-run-history-item-meta">
          {{ item.loopCount || 1 }} 轮 / {{ item.threadCount || 1 }} 线程 / {{ item.durationMs ?? 0 }} ms
        </span>
      </button>
      <div v-if="!items.length" class="scenario-step-empty">暂无测试报告</div>
    </div>
  </div>
</template>
