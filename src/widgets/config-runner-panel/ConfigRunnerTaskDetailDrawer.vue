<script setup lang="ts">
import { computed } from 'vue'
import { DocumentCopy } from '@element-plus/icons-vue'

import { ConfigTypeBadge } from '@/entities/config'
import {
  readRunnerTaskDurationMs,
  readRunnerTaskSummary,
  type LocalRunnerTaskDetailResponse,
} from '@/entities/local-runner'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import {
  formatDurationMs,
  formatJson,
  formatUnknown,
  getLogLevelTone,
  getTaskStatusLabel,
  getTaskStatusTone,
  getTaskTypeLabel,
  hasRecordValue,
} from './configRunnerPanel.helpers'

const props = defineProps<{
  loading: boolean
  errorMessage: string
  detail: LocalRunnerTaskDetailResponse | null
}>()

const emit = defineEmits<{
  copyRunId: []
  copyLogs: []
}>()

const visible = defineModel<boolean>({ required: true })

const summaryItems = computed(() => {
  if (!props.detail) {
    return []
  }
  const summary = readRunnerTaskSummary(props.detail)
  return [
    { label: '总步骤', value: summary.totalSteps },
    { label: '通过', value: summary.passedSteps },
    { label: '失败', value: summary.failedSteps },
    { label: '跳过', value: summary.skippedSteps },
    { label: '错误', value: summary.errorMessage },
  ]
    .filter(item => item.value != null && item.value !== '')
    .map(item => ({ label: item.label, value: formatUnknown(item.value) }))
})

const durationText = computed(() => formatDurationMs(
  props.detail ? readRunnerTaskDurationMs(props.detail) : null,
))
</script>

<template>
  <el-drawer v-model="visible" title="本地任务详情" size="760px">
    <AppLoadingState v-if="loading" text="正在加载任务详情..." />
    <AppEmptyState
      v-else-if="errorMessage"
      title="任务详情加载失败"
      :description="errorMessage"
    />
    <div v-else-if="detail" class="config-runner-detail">
      <header class="config-runner-detail__header">
        <div>
          <h3>{{ getTaskTypeLabel(detail.taskType) }}</h3>
          <code>{{ detail.runId }}</code>
        </div>
        <ConfigTypeBadge
          :label="getTaskStatusLabel(detail.status)"
          :tone="getTaskStatusTone(detail.status)"
        />
      </header>

      <div class="config-runner-detail__actions">
        <AppButton size="small" plain :icon="DocumentCopy" @click="emit('copyRunId')">复制 Run ID</AppButton>
        <AppButton
          size="small"
          plain
          :icon="DocumentCopy"
          :disabled="!detail.logs.length"
          @click="emit('copyLogs')"
        >
          复制日志
        </AppButton>
      </div>

      <section class="config-runner-detail__section">
        <h4>状态</h4>
        <div class="config-runner-detail-grid">
          <div><span>Runner</span><strong>{{ detail.runnerId || '-' }}</strong></div>
          <div><span>阶段</span><strong>{{ detail.currentStage || '等待阶段上报' }}</strong></div>
          <div><span>进度</span><strong>{{ detail.progress.percent }}%</strong></div>
          <div><span>耗时</span><strong>{{ durationText }}</strong></div>
        </div>
        <el-progress :percentage="detail.progress.percent" :stroke-width="8" />
      </section>

      <section class="config-runner-detail__section">
        <h4>时间线</h4>
        <div class="config-runner-detail-timeline">
          <div><span>分配</span><strong>{{ detail.assignedAt || '-' }}</strong></div>
          <div><span>开始</span><strong>{{ detail.startedAt || '-' }}</strong></div>
          <div><span>完成</span><strong>{{ detail.completedAt || '-' }}</strong></div>
          <div><span>最近上报</span><strong>{{ detail.lastReportedAt || '-' }}</strong></div>
        </div>
      </section>

      <section v-if="detail.errorMessage || detail.statusMessage" class="config-runner-detail__section">
        <h4>消息</h4>
        <p v-if="detail.statusMessage">{{ detail.statusMessage }}</p>
        <pre v-if="detail.errorMessage">{{ detail.errorMessage }}</pre>
      </section>

      <section v-if="summaryItems.length" class="config-runner-detail__section">
        <h4>结果摘要</h4>
        <div class="config-runner-detail-summary">
          <div v-for="item in summaryItems" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>

      <section class="config-runner-detail__section">
        <h4>最近日志</h4>
        <div v-if="detail.logs.length" class="config-runner-detail-logs">
          <article
            v-for="log in detail.logs"
            :key="`${log.sequenceNo}-${log.loggedAt}-${log.message}`"
            class="config-runner-detail-log"
          >
            <div class="config-runner-detail-log__head">
              <ConfigTypeBadge :label="log.level" :tone="getLogLevelTone(log)" />
              <span>{{ log.loggedAt || '-' }}</span>
              <code v-if="log.stepId">{{ log.stepId }}</code>
            </div>
            <p>{{ log.message || '-' }}</p>
            <pre v-if="hasRecordValue(log.data)">{{ formatJson(log.data) }}</pre>
          </article>
        </div>
        <span v-else class="config-runner-muted">暂无日志</span>
      </section>

      <section v-if="hasRecordValue(detail.result)" class="config-runner-detail__section">
        <h4>原始结果</h4>
        <pre>{{ formatJson(detail.result) }}</pre>
      </section>
    </div>
  </el-drawer>
</template>

<style scoped src="./config-runner-task-detail-drawer.css"></style>
