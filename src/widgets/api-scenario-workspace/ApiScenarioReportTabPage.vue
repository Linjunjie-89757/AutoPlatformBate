<script setup lang="ts">
defineProps([
  "activeScenarioReportTabLoading",
  "activeScenarioReportTabDetail",
  "activeScenarioEditorTab",
  "activeScenarioRunResult",
  "scenarioRunResultTone",
  "scenarioRunResultLabel",
  "formatScenarioDateTime",
  "activeScenarioRunDatasetName",
  "activeScenarioRunLoopCount",
  "activeScenarioRunThreadCount",
  "activeScenarioRunSummary",
  "activeScenarioRunDataIterations",
  "activeScenarioRunDataSummary",
  "activeScenarioRunFailureSummary",
  "activeScenarioRunSteps",
  "scenarioStepResultTone",
  "scenarioStepResultLabel",
  "openScenarioReportStepDrawer"
])
</script>

<template>
  <div v-loading="activeScenarioReportTabLoading" class="scenario-report-tab-page">
    <div class="scenario-report-tab-head">
      <div class="scenario-report-tab-title">
        <span :class="['scenario-run-result-pill', `is-${scenarioRunResultTone(activeScenarioRunResult)}`]">
          {{ scenarioRunResultLabel(activeScenarioRunResult) }}
        </span>
        <div>
          <strong>{{ activeScenarioReportTabDetail?.scenarioName || activeScenarioEditorTab.title }}</strong>
          <small>{{ formatScenarioDateTime(activeScenarioReportTabDetail?.createdAt) }} · {{ activeScenarioRunDatasetName || '未使用测试数据' }}</small>
        </div>
      </div>
      <div class="scenario-report-tab-meta">
        <span>{{ activeScenarioRunLoopCount || 1 }} 轮</span>
        <span>{{ activeScenarioRunThreadCount || 1 }} 线程</span>
        <span>{{ activeScenarioReportTabDetail?.durationMs ?? activeScenarioRunSummary.duration }} ms</span>
      </div>
    </div>

    <div v-if="activeScenarioReportTabDetail" class="scenario-report-tab-body app-soft-scrollbar">
      <div v-if="activeScenarioRunDataIterations.length" class="scenario-run-data-meta">
        <span><b>测试数据</b>{{ activeScenarioRunDatasetName }}</span>
        <span><b>数据行数</b>{{ activeScenarioRunDataSummary.total }}</span>
        <span><b>循环次数</b>{{ activeScenarioRunLoopCount }}</span>
        <span><b>线程数</b>{{ activeScenarioRunThreadCount }}</span>
      </div>
      <div class="scenario-run-summary-grid">
        <div>
          <span>{{ activeScenarioRunDataIterations.length ? '总行数' : '总步骤' }}</span>
          <strong>{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.total : activeScenarioRunSummary.total }}</strong>
        </div>
        <div>
          <span>通过</span>
          <strong class="is-passed">{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.passed : activeScenarioRunSummary.passed }}</strong>
        </div>
        <div>
          <span>失败</span>
          <strong class="is-failed">{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.failed : activeScenarioRunSummary.failed }}</strong>
        </div>
        <div>
          <span>总耗时</span>
          <strong>{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.duration : activeScenarioRunSummary.duration }} ms</strong>
        </div>
      </div>
      <div v-if="activeScenarioRunFailureSummary" class="scenario-run-failure-summary">
        {{ activeScenarioRunFailureSummary }}
      </div>
      <div v-if="activeScenarioRunDataIterations.length" class="scenario-step-table scenario-run-history-table scenario-run-data-table app-soft-scrollbar">
        <div class="scenario-step-table-header">
          <span>轮次</span>
          <span>行号</span>
          <span>用例描述</span>
          <span>结果</span>
          <span>步骤数</span>
          <span>耗时 ms</span>
          <span>失败步骤</span>
          <span>错误原因</span>
        </div>
        <div
          v-for="row in activeScenarioRunDataIterations"
          :key="`${row.loopIndex || 1}-${row.rowIndex}`"
          class="scenario-step-table-row"
        >
          <span>{{ row.loopIndex || 1 }}</span>
          <span>{{ row.rowIndex }}</span>
          <span>{{ row.caseDesc || '-' }}</span>
          <span :class="['scenario-run-step-result', `is-${scenarioRunResultTone(row.result)}`]">
            {{ scenarioRunResultLabel(row.result) }}
          </span>
          <span>{{ row.stepCount ?? '-' }}</span>
          <span>{{ row.durationMs ?? '-' }}</span>
          <span>{{ row.failedStep || '-' }}</span>
          <span class="scenario-run-step-error">{{ row.failureSummary || '-' }}</span>
        </div>
      </div>
      <div class="scenario-step-table scenario-run-history-table app-soft-scrollbar">
        <div class="scenario-step-table-header">
          <span>#</span>
          <span>步骤</span>
          <span>结果</span>
          <span>耗时 ms</span>
          <span>错误信息</span>
        </div>
        <button
          v-for="row in activeScenarioRunSteps"
          :key="`${row.stepOrder}-${row.stepName}`"
          type="button"
          class="scenario-step-table-row scenario-report-step-row"
          @click="openScenarioReportStepDrawer(row)"
        >
          <span>{{ row.stepOrder }}</span>
          <span>{{ row.stepName || '-' }}</span>
          <span :class="['scenario-run-step-result', `is-${scenarioStepResultTone(row)}`]">
            {{ scenarioStepResultLabel(row) }}
          </span>
          <span>{{ row.durationMs ?? '-' }}</span>
          <span class="scenario-run-step-error">{{ row.errorMessage || '-' }}</span>
        </button>
        <div v-if="!activeScenarioRunSteps.length" class="scenario-step-empty">暂无步骤明细</div>
      </div>
    </div>
    <div v-else-if="!activeScenarioReportTabLoading" class="scenario-step-empty">报告详情加载失败或已不存在</div>
  </div>
</template>


