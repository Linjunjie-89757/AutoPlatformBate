<script setup lang="ts">
import { ChevronLeft as LucideChevronLeft, ChevronRight as LucideChevronRight } from '@lucide/vue'

import type {
  ApiAutomationReportDetail,
  ApiRunStepResult,
  ApiRuntimeContextSnapshot,
} from '@/entities/api-automation'

import type { ApiReportTreeNode } from './apiReportDetailTypes'

type ContextVariableRow = { key: string, value: string }
type RunnerContextRow = { label: string, value: string }

defineProps<{
  detail: ApiAutomationReportDetail | null
  loading: boolean
  errorMessage: string
  actionLoadingKey: string
  summaryRows: string[][]
  contextSnapshot: ApiRuntimeContextSnapshot | null
  contextVariables: ContextVariableRow[]
  contextVariableSetLabel: string
  contextVariableSetDetails: string[]
  localRunnerRows: RunnerContextRow[]
  reportTree: ApiReportTreeNode[]
  expandedTreeKeys: string[]
  formatDateTime: (value?: string | null) => string
  formatDuration: (value?: number | null) => string
  runResultClass: (result?: string | null) => string
  runResultLabel: (result?: string | null) => string
  reportObjectTypeLabel: (value?: string | null) => string
  reportTreeNodeTypeLabel: (node: ApiReportTreeNode) => string
}>()

const emit = defineEmits<{
  back: []
  rerun: [detail: ApiAutomationReportDetail]
  archive: [detail: ApiAutomationReportDetail]
  toggleNode: [node: ApiReportTreeNode]
  openStep: [step: ApiRunStepResult]
}>()

function handleNodeClick(node: ApiReportTreeNode) {
  if (!node.children.length && node.step) {
    emit('openStep', node.step)
    return
  }
  emit('toggleNode', node)
}
</script>

<template>
  <div class="api-report-detail-page" v-loading="loading">
    <div class="api-report-detail-page__header">
      <button type="button" class="api-report-detail-page__back" @click="emit('back')">
        <LucideChevronLeft class="api-workspace-icon" />
        <span>返回报告列表</span>
      </button>
      <div class="api-report-detail-page__title">
        <span :class="['api-report-result', runResultClass(detail?.result)]">
          {{ runResultLabel(detail?.result) }}
        </span>
        <div>
          <strong>{{ detail?.objectName || '执行报告' }}</strong>
          <small>{{ reportObjectTypeLabel(detail?.objectType || '') }} · {{ formatDateTime(detail?.createdAt) }}</small>
        </div>
      </div>
      <div v-if="detail" class="api-report-detail-page__actions">
        <el-button
          :loading="actionLoadingKey === `rerun:${detail.reportKey}`"
          @click="emit('rerun', detail)"
        >
          重跑
        </el-button>
        <el-button
          v-if="!detail.archived"
          type="warning"
          plain
          :loading="actionLoadingKey === `archive:${detail.reportKey}`"
          @click="emit('archive', detail)"
        >
          归档
        </el-button>
      </div>
    </div>

    <div v-if="errorMessage" class="api-report-empty">{{ errorMessage }}</div>
    <div v-else-if="detail" class="api-report-detail-page__body app-soft-scrollbar">
      <section class="api-report-detail-section is-overview">
        <div class="api-report-detail-section__head">
          <h3>执行概览</h3>
          <span>{{ detail.operatorName || '系统' }}</span>
        </div>
        <div class="api-report-summary-grid">
          <div v-for="[label, value] in summaryRows" :key="label">
            <span>{{ label }}</span>
            <strong>{{ value }}</strong>
          </div>
        </div>
        <p v-if="detail.failureSummary" class="api-report-failure">
          {{ detail.failureSummary }}
        </p>
      </section>

      <section v-if="contextSnapshot" class="api-report-detail-section">
        <div class="api-report-detail-section__head">
          <h3>运行上下文快照</h3>
          <span>用于复现本次执行</span>
        </div>
        <div class="api-report-context-grid">
          <div>
            <span>环境</span>
            <strong>{{ detail.environmentName || contextSnapshot.environment?.id || '未选择环境' }}</strong>
            <small>{{ contextSnapshot.environment?.baseUrl || '-' }}</small>
          </div>
          <div>
            <span>变量集</span>
            <strong>{{ contextVariableSetLabel }}</strong>
            <small>
              <template v-if="contextVariableSetDetails.length">
                {{ contextVariableSetDetails.join(' / ') }}
              </template>
              <template v-else>ID {{ contextSnapshot.variableSet?.id ?? detail.variableSetId ?? '-' }}</template>
            </small>
          </div>
          <div>
            <span>Mock</span>
            <strong>{{ contextSnapshot.mock?.appName || '未启用 Mock' }}</strong>
            <small>
              <template v-if="contextSnapshot.mock?.businessScenarioName">
                {{ contextSnapshot.mock.businessScenarioName }}
              </template>
              <template v-else>{{ contextSnapshot.mock?.appCode || contextSnapshot.mock?.baseUrl || '-' }}</template>
            </small>
          </div>
          <div>
            <span>运行变量</span>
            <strong>{{ contextVariables.length }}</strong>
            <small>快照保存的实际变量</small>
          </div>
        </div>
        <div v-if="localRunnerRows.length" class="api-report-runner-context">
          <div v-for="row in localRunnerRows" :key="row.label">
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>
        <details v-if="contextVariables.length" class="api-report-context-variables">
          <summary>查看运行变量</summary>
          <div>
            <span v-for="item in contextVariables" :key="item.key">
              <b>{{ item.key }}</b>
              <em>{{ item.value || '-' }}</em>
            </span>
          </div>
        </details>
      </section>

      <section class="api-report-detail-section">
        <div class="api-report-detail-section__head">
          <h3>执行链路</h3>
          <span>{{ detail.stepResults.length }} 步</span>
        </div>
        <div v-if="!reportTree.length" class="api-report-empty">暂无执行链路</div>
        <div v-else class="api-report-execution-tree">
          <template v-for="node in reportTree" :key="node.key">
            <button
              type="button"
              :class="[
                'api-report-tree-row',
                `is-${node.type}`,
                { expanded: expandedTreeKeys.includes(node.key), 'is-leaf': !node.children.length },
              ]"
              @click="handleNodeClick(node)"
            >
              <span class="api-report-tree-toggle">
                <LucideChevronRight v-if="node.children.length" class="api-workspace-icon" />
              </span>
              <span :class="['api-report-result', runResultClass(node.result)]">{{ node.success === null ? runResultLabel(node.result) : node.success ? '通过' : '失败' }}</span>
              <span class="api-report-tree-main">
                <strong>{{ node.title }}</strong>
                <em>{{ reportTreeNodeTypeLabel(node) }}</em>
              </span>
              <span>{{ node.statusCode ? `HTTP ${node.statusCode}` : '-' }}</span>
              <span>{{ formatDuration(node.durationMs) }}</span>
              <span class="api-report-tree-error">{{ node.failureSummary || '-' }}</span>
            </button>

            <div v-if="expandedTreeKeys.includes(node.key)" class="api-report-tree-children">
              <button
                v-for="child in node.children"
                :key="child.key"
                type="button"
                :class="[
                  'api-report-tree-row',
                  'is-child',
                  `is-${child.type}`,
                  { expanded: expandedTreeKeys.includes(child.key), 'is-leaf': !child.children.length },
                ]"
                @click="handleNodeClick(child)"
              >
                <span class="api-report-tree-toggle">
                  <LucideChevronRight v-if="child.children.length" class="api-workspace-icon" />
                </span>
                <span :class="['api-report-result', child.success === false ? 'is-failed' : 'is-passed']">{{ child.success === false ? '失败' : '通过' }}</span>
                <span class="api-report-tree-main">
                  <strong>{{ child.title }}</strong>
                  <em>{{ reportTreeNodeTypeLabel(child) }}</em>
                </span>
                <span>{{ child.statusCode ? `HTTP ${child.statusCode}` : '-' }}</span>
                <span>{{ formatDuration(child.durationMs) }}</span>
                <span class="api-report-tree-error">{{ child.failureSummary || '-' }}</span>
              </button>
            </div>
          </template>
        </div>
      </section>

      <section v-if="detail.dataIterations.length" class="api-report-detail-section">
        <div class="api-report-detail-section__head">
          <h3>数据驱动运行结果</h3>
          <span>{{ detail.dataIterations.length }} 条</span>
        </div>
        <div class="api-report-item-list">
          <div
            v-for="row in detail.dataIterations"
            :key="`${row.loopIndex || 1}-${row.rowIndex}`"
            class="api-report-item-row"
          >
            <span :class="['api-report-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
            <small>第 {{ row.loopIndex || 1 }} 轮 / 第 {{ row.rowIndex }} 行</small>
            <strong>{{ row.caseDesc || '未命名数据行' }}</strong>
            <span>{{ row.stepCount ?? 0 }} 步</span>
            <span>{{ formatDuration(row.durationMs) }}</span>
            <p v-if="row.failureSummary">{{ row.failureSummary }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.api-report-detail-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f8fafc;
}

.api-report-detail-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-report-detail-page__back {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
  font-size: 13px;
}

.api-report-detail-page__back:hover {
  background: #dbeafe;
}

.api-report-detail-page__title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 12px;
}

.api-report-detail-page__title > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.api-report-detail-page__title strong {
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-detail-page__title small {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.api-report-detail-page__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-report-detail-page__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: 16px 18px 24px;
}

.api-report-detail-section {
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-detail-section.is-overview {
  border-color: #dbeafe;
}

.api-report-detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.api-report-detail-section__head h3 {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.api-report-detail-section__head span {
  color: #6b7280;
  font-size: 12px;
}

.api-report-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.api-report-summary-grid div {
  display: flex;
  min-width: 0;
  min-height: 58px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfdff;
}

.api-report-summary-grid span {
  color: #6b7280;
  font-size: 12px;
}

.api-report-summary-grid strong {
  overflow: hidden;
  color: #111827;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.api-report-context-grid div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.api-report-context-grid span,
.api-report-context-grid small {
  display: block;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-grid strong {
  display: block;
  overflow: hidden;
  margin: 5px 0 3px;
  color: #111827;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-runner-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.api-report-runner-context div {
  min-width: 0;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #eff6ff;
  padding: 8px 10px;
}

.api-report-runner-context span,
.api-report-runner-context strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-runner-context span {
  color: #1d4ed8;
  font-size: 12px;
}

.api-report-runner-context strong {
  margin-top: 4px;
  color: #111827;
  font-size: 13px;
}

.api-report-context-variables {
  margin-top: 12px;
  color: #374151;
  font-size: 12px;
}

.api-report-context-variables summary {
  cursor: pointer;
  user-select: none;
}

.api-report-context-variables div {
  display: grid;
  max-height: 220px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
  overflow: auto;
}

.api-report-context-variables span {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f3f4f6;
}

.api-report-context-variables b,
.api-report-context-variables em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-variables em {
  margin-top: 3px;
  color: #6b7280;
  font-style: normal;
}

.api-report-failure {
  margin: 12px 0 0;
  border-radius: 8px;
  background: #fef2f2;
  padding: 10px 12px;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.6;
}

.api-report-item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-report-item-row {
  display: grid;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfdff;
  padding: 10px 12px;
  grid-template-columns: 64px 72px minmax(0, 1fr) 58px 84px;
}

.api-report-item-row strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-item-row small,
.api-report-item-row span:not(.api-report-result) {
  color: #6b7280;
  font-size: 12px;
}

.api-report-item-row p {
  grid-column: 1 / -1;
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
}

.api-report-execution-tree {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-report-tree-row {
  display: grid;
  align-items: center;
  width: 100%;
  min-height: 44px;
  grid-template-columns: 28px 64px minmax(220px, 1fr) 90px 90px minmax(180px, 0.8fr);
  gap: 10px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  padding: 0 12px;
  color: #374151;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-tree-row:hover {
  background: #f8fafc;
}

.api-report-tree-row.is-child {
  padding-left: 34px;
  background: #fbfdff;
}

.api-report-tree-row.is-leaf .api-report-tree-main strong {
  color: #2563eb;
}

.api-report-tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #64748b;
  transition: transform 0.16s ease;
}

.api-report-tree-row.expanded .api-report-tree-toggle {
  transform: rotate(90deg);
}

.api-report-tree-main {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.api-report-tree-main strong,
.api-report-tree-row > span:not(.api-report-result):not(.api-report-tree-toggle):not(.api-report-tree-main) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-tree-main strong {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.api-report-tree-main em {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 20px;
  border-radius: 4px;
  background: #f3f4f6;
  padding: 0 6px;
  color: #6b7280;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
}

.api-report-tree-row > span:not(.api-report-result):not(.api-report-tree-toggle):not(.api-report-tree-main) {
  color: #6b7280;
  font-size: 12px;
}

.api-report-tree-error {
  color: #b91c1c !important;
}

.api-report-result {
  display: inline-flex;
  min-width: 52px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  white-space: nowrap;
}

.api-report-result.is-passed,
.api-report-result.is-success {
  background: #dcfce7;
  color: #15803d;
}

.api-report-result.is-failed,
.api-report-result.is-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.api-report-result.is-neutral {
  background: #f3f4f6;
  color: #4b5563;
}

.api-report-empty {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--app-border);
  border-radius: 8px;
  background: #fff;
  color: #94a3b8;
  font-size: 13px;
}

.api-workspace-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}
</style>
