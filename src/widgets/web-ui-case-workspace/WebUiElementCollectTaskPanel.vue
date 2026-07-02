<script setup lang="ts">
import { computed } from 'vue'
import {
  Close,
  Clock,
  Cpu,
  Link,
  RefreshRight,
  Timer,
  WarningFilled,
} from '@element-plus/icons-vue'

import type { WebUiElementCollectTaskResponse } from '@/entities/web-ui-automation'
import {
  buildCollectTaskStages,
  formatCollectFilterReason,
  type WebUiCollectTaskStageStatus,
} from '@/entities/web-ui-automation/lib/collectTask'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  task: WebUiElementCollectTaskResponse
  refreshing: boolean
  polling: boolean
}>()

const emit = defineEmits<{
  refresh: []
  cancel: []
}>()

const collectTaskStages = computed(() => buildCollectTaskStages(props.task))
const canCancelTask = computed(() => !['COMPLETED', 'FAILED', 'DEGRADED', 'CANCELED'].includes(props.task.status || ''))

const taskDurationText = computed(() => {
  if (!props.task.createdAt) return '-'
  const startTime = new Date(props.task.createdAt).getTime()
  const endTime = props.task.completedAt ? new Date(props.task.completedAt).getTime() : Date.now()
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return '-'
  const seconds = Math.max(1, Math.round((endTime - startTime) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds ? `${minutes} 分 ${restSeconds} 秒` : `${minutes} 分`
})

const taskStats = computed(() => [
  { label: '原始候选', value: props.task.rawCount },
  { label: '最终候选', value: props.task.finalCount },
  { label: '空定位', value: props.task.filterSummary?.emptyLocatorCount ?? 0 },
  { label: '重复过滤', value: props.task.filterSummary?.duplicateCount ?? 0 },
  { label: '低稳定过滤', value: props.task.filterSummary?.lowStabilityCount ?? 0 },
])

const taskWarning = computed(() => {
  if (props.task.status === 'FAILED') {
    return {
      type: 'error' as const,
      title: props.task.message || '采集任务失败',
      description: '请检查本地 Runner 是否在线、目标页面是否仍可访问，并确认页面没有跳转到登录页后重新采集。',
    }
  }
  if (props.task.status === 'DEGRADED') {
    return {
      type: 'warning' as const,
      title: props.task.message || '采集任务已降级',
      description: '当前候选可能没有经过本地页面验证，保存前建议重新连接 Runner 或重新进入目标页面采集。',
    }
  }
  if (props.task.status === 'CANCELED') {
    return {
      type: 'info' as const,
      title: props.task.message || '采集任务已取消',
      description: '任务已停止刷新。已生成的候选仍可查看，如需继续请重新采集当前页。',
    }
  }
  return null
})

function formatCollectTaskStatus(status?: string | null) {
  if (status === 'COMPLETED') return '已完成'
  if (status === 'UPLOADED') return '快照已上传'
  if (status === 'RULE_CLEANING') return '规则清洗中'
  if (status === 'AI_ANALYZING') return 'AI 分析中'
  if (status === 'WAITING_LOCAL_VALIDATION') return '等待本地验证'
  if (status === 'VALIDATING') return '本地验证中'
  if (status === 'PROCESSING') return '处理中'
  if (status === 'PENDING') return '待处理'
  if (status === 'FAILED') return '失败'
  if (status === 'DEGRADED') return '已降级'
  if (status === 'CANCELED') return '已取消'
  return status || '未知'
}

function getCollectTaskStatusTagType(status?: string | null) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'WAITING_LOCAL_VALIDATION' || status === 'VALIDATING') return 'primary'
  return 'info'
}

function toElementStepStatus(status: WebUiCollectTaskStageStatus) {
  if (status === 'done') return 'success'
  if (status === 'running') return 'process'
  if (status === 'failed') return 'error'
  return 'wait'
}
</script>

<template>
  <section class="web-ui-collect-task">
    <div class="web-ui-collect-task__header">
      <div class="web-ui-collect-task__identity">
        <strong>采集任务 #{{ task.taskId }}</strong>
        <el-tag :type="getCollectTaskStatusTagType(task.status)" effect="light">
          {{ formatCollectTaskStatus(task.status) }}
        </el-tag>
        <el-tag v-if="polling" type="info" effect="light">自动刷新中</el-tag>
        <span>{{ task.source }}</span>
      </div>
      <div class="web-ui-collect-task__actions">
        <AppButton
          v-if="canCancelTask"
          size="small"
          :icon="Close"
          @click="emit('cancel')"
        >
          取消任务
        </AppButton>
        <AppButton
          size="small"
          :icon="RefreshRight"
          :loading="refreshing"
          @click="emit('refresh')"
        >
          刷新
        </AppButton>
      </div>
    </div>

    <el-alert
      v-if="taskWarning"
      :type="taskWarning.type"
      :title="taskWarning.title"
      :description="taskWarning.description"
      show-icon
      :closable="false"
    />

    <div class="web-ui-collect-task__meta">
      <span v-if="task.pageTitle">页面：{{ task.pageTitle }}</span>
      <span v-if="task.aiModelName">
        <el-icon><Cpu /></el-icon>
        AI 模型：{{ task.aiModelName }}
      </span>
      <span v-if="task.actualUrl" class="web-ui-collect-task__url">
        <el-icon><Link /></el-icon>
        {{ task.actualUrl }}
      </span>
      <span v-if="task.createdAt">
        <el-icon><Clock /></el-icon>
        创建：{{ task.createdAt }}
      </span>
      <span v-if="task.completedAt">完成：{{ task.completedAt }}</span>
      <span>
        <el-icon><Timer /></el-icon>
        耗时：{{ taskDurationText }}
      </span>
    </div>

    <el-alert
      v-if="task.aiModelName || (task.message && /AI|ai/.test(task.message))"
      class="web-ui-collect-task__ai-alert"
      :type="task.message && /失败|不可用|不存在|unavailable|failed/i.test(task.message) ? 'warning' : 'success'"
      :title="task.aiModelName ? `AI 处理：${task.aiModelName}` : 'AI 处理'"
      :description="task.message || 'AI 已参与候选元素命名、分组和说明增强'"
      show-icon
      :closable="false"
    />

    <div class="web-ui-collect-task__stats">
      <div v-for="item in taskStats" :key="item.label" class="web-ui-collect-task__stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <el-progress
      :percentage="task.progressPercent"
      :status="task.status === 'FAILED' ? 'exception' : task.status === 'COMPLETED' ? 'success' : undefined"
      striped
      striped-flow
    />

    <el-steps class="web-ui-collect-task__stages" :active="collectTaskStages.length" finish-status="success" align-center>
      <el-step
        v-for="stage in collectTaskStages"
        :key="stage.key"
        :title="stage.title"
        :status="toElementStepStatus(stage.status)"
        :description="stage.description"
      >
        <template #description>
          <div class="web-ui-collect-task__stage-description">
            <span>{{ stage.description }}</span>
            <el-tag v-if="stage.status === 'degraded'" type="warning" effect="light" size="small">降级</el-tag>
          </div>
        </template>
      </el-step>
    </el-steps>

    <div v-if="task.filterLogs.length" class="web-ui-collect-task__filter-log">
      <div class="web-ui-collect-task__filter-log-title">
        <el-icon><WarningFilled /></el-icon>
        <span>过滤日志</span>
      </div>
      <div
        v-for="log in task.filterLogs"
        :key="`${log.stage}-${log.reason}`"
        class="web-ui-collect-task__filter-log-item"
      >
        <span>{{ formatCollectFilterReason(log.reason) }}</span>
        <strong>{{ log.count }}</strong>
        <small>{{ log.message || '暂无说明' }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.web-ui-collect-task {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.web-ui-collect-task__header,
.web-ui-collect-task__actions,
.web-ui-collect-task__identity,
.web-ui-collect-task__meta,
.web-ui-collect-task__filter-log,
.web-ui-collect-task__filter-log-title,
.web-ui-collect-task__filter-log-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-collect-task__header {
  justify-content: space-between;
}

.web-ui-collect-task__identity {
  min-width: 0;
}

.web-ui-collect-task__identity span,
.web-ui-collect-task__meta,
.web-ui-collect-task__filter-log-item small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-task__meta {
  line-height: 1.5;
}

.web-ui-collect-task__meta span,
.web-ui-collect-task__url {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-collect-task__url {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.web-ui-collect-task__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: var(--app-space-2);
}

.web-ui-collect-task__stat {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
}

.web-ui-collect-task__stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-collect-task__stat strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: 1.1;
}

.web-ui-collect-task__stages {
  min-width: 0;
}

.web-ui-collect-task__stage-description {
  display: grid;
  gap: var(--app-space-1);
  justify-items: center;
  min-width: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.web-ui-collect-task__filter-log {
  align-items: stretch;
}

.web-ui-collect-task__filter-log-title {
  flex-basis: 100%;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-task__filter-log-item {
  padding: var(--app-space-1) var(--app-space-2);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
}
</style>
