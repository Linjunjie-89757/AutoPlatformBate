<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  CopyDocument,
  Download,
  Link,
  Picture,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  formatBrowserType,
  formatDurationMs,
  formatExecutionLocation,
  formatLocatorType,
  formatStepType,
  formatWebUiDateTime,
  webUiAutomationApi,
  WebUiRunStatusBadge,
  type WebUiRunDetail,
  type WebUiRunStepResult,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  modelValue: boolean
  workspaceCode: string
  runId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'locate-step': [payload: { caseId: number | null; step: WebUiRunStepResult }]
  'copy-link': [runId: number]
  'share-public': [runId: number]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const loading = ref(false)
const errorMessage = ref('')
const detail = ref<WebUiRunDetail | null>(null)
let requestSeq = 0
let refreshTimer: ReturnType<typeof window.setTimeout> | null = null

const failedSteps = computed(() => detail.value?.steps.filter(step => step.status === 'FAILED') ?? [])
const contextVariables = computed(() => Object.entries(detail.value?.context?.variables ?? {}))
const executionLocation = computed(() => detail.value?.context?.executionLocation || detail.value?.summary.executionLocation || 'SERVER')
const localRunnerRunId = computed(() => detail.value?.context?.localRunnerRunId || detail.value?.summary.localRunnerRunId || null)
const isRunning = computed(() => detail.value?.summary.status === 'RUNNING')

function stopAutoRefresh() {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

function scheduleAutoRefresh() {
  stopAutoRefresh()
  if (!props.modelValue || !props.runId || !isRunning.value) {
    return
  }
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    void loadDetail(true)
  }, 2000)
}

async function loadDetail(silent = false) {
  const requestId = ++requestSeq
  const workspaceCode = props.workspaceCode
  const runId = props.runId

  if (!props.modelValue || !runId) {
    loading.value = false
    detail.value = null
    stopAutoRefresh()
    return
  }

  if (!silent) {
    loading.value = true
  }
  errorMessage.value = ''
  try {
    const result = await webUiAutomationApi.getRunDetail(workspaceCode, runId)
    if (requestId === requestSeq && props.modelValue && props.workspaceCode === workspaceCode && props.runId === runId) {
      detail.value = result
      scheduleAutoRefresh()
    }
  } catch (error) {
    if (requestId === requestSeq && props.modelValue && props.workspaceCode === workspaceCode && props.runId === runId) {
      errorMessage.value = getRequestErrorMessage(error)
      stopAutoRefresh()
    }
  } finally {
    if (requestId === requestSeq && props.modelValue && props.workspaceCode === workspaceCode && props.runId === runId) {
      loading.value = false
    }
  }
}

function closeDrawer() {
  requestSeq += 1
  stopAutoRefresh()
  visible.value = false
}

function isFailedStep(row: WebUiRunStepResult) {
  return row.status === 'FAILED'
}

function getStepRowClassName({ row }: { row: WebUiRunStepResult }) {
  return isFailedStep(row) ? 'web-ui-run-step-table__row--failed' : ''
}

function formatStepLocator(row: WebUiRunStepResult) {
  if (!row.locatorType) {
    return '-'
  }
  return `${formatLocatorType(row.locatorType)}: ${row.locatorValue || '-'}`
}

function formatStepInput(row: WebUiRunStepResult) {
  return row.inputValueSnapshot || '-'
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '-'
  }
  return value ? '是' : '否'
}

function buildRunReportSummary() {
  const current = detail.value
  if (!current) {
    return ''
  }
  const summary = current.summary
  const lines = [
    `# Web UI 执行报告：${summary.caseName}`,
    '',
    `- Run ID：${summary.id}`,
    `- 批次 ID：${summary.batchId || '-'}`,
    `- 结果：${summary.status}`,
    `- 执行来源：${formatExecutionLocation(current.context?.executionLocation || summary.executionLocation)}`,
    `- 环境：${summary.environmentName || current.context?.environment?.name || '-'}`,
    `- Base URL：${summary.baseUrl || current.context?.environment?.baseUrl || '-'}`,
    `- 浏览器：${formatBrowserType(summary.browserType)}`,
    `- 无头模式：${formatBoolean(summary.headless)}`,
    `- 耗时：${formatDurationMs(summary.durationMs)}`,
    `- 步骤：${summary.passedSteps} 通过 / ${summary.failedSteps} 失败 / ${summary.skippedSteps} 跳过`,
    `- 开始时间：${formatWebUiDateTime(summary.startedAt)}`,
    `- 报告链接：${new URL(`/automation/web?tab=runs&runId=${summary.id}`, window.location.origin).toString()}`,
  ]
  if (summary.failureSummary) {
    lines.push(`- 失败摘要：${summary.failureSummary}`)
  }
  if (failedSteps.value.length) {
    lines.push('', '## 失败步骤')
    failedSteps.value.forEach(step => {
      lines.push(`- 第 ${step.sortOrder} 步 ${step.stepName || formatStepType(step.stepType)}：${step.errorMessage || '未记录错误信息'}`)
    })
  }
  return lines.join('\n')
}

async function copyRunReportSummary() {
  const text = buildRunReportSummary()
  if (!text) {
    ElMessage.warning('暂无可复制的执行报告')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('执行报告摘要已复制')
  } catch {
    ElMessage.warning('当前浏览器不允许自动复制，请手动选择文本复制')
  }
}

function locateStep(row: WebUiRunStepResult) {
  emit('locate-step', {
    caseId: detail.value?.summary.caseId ?? null,
    step: row,
  })
}

watch(
  () => [props.modelValue, props.runId, props.workspaceCode] as const,
  () => {
    stopAutoRefresh()
    void loadDetail()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<template>
  <el-drawer
    v-model="visible"
    title="执行报告"
    size="72%"
    destroy-on-close
  >
    <div v-loading="loading" class="web-ui-run-detail">
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <template v-else-if="detail">
        <section class="web-ui-run-actions">
          <div>
            <span>Run #{{ detail.summary.id }}</span>
            <span v-if="detail.summary.batchId">Batch #{{ detail.summary.batchId }}</span>
          </div>
          <div class="web-ui-run-actions__buttons">
            <AppButton size="small" :icon="CopyDocument" @click="copyRunReportSummary">复制报告摘要</AppButton>
            <AppButton size="small" :icon="CopyDocument" @click="emit('copy-link', detail.summary.id)">复制报告链接</AppButton>
            <AppButton size="small" :icon="Link" @click="emit('share-public', detail.summary.id)">公开分享</AppButton>
          </div>
        </section>

        <section class="web-ui-run-summary">
          <div>
            <span>用例</span>
            <strong>{{ detail.summary.caseName }}</strong>
          </div>
          <div>
            <span>结果</span>
            <WebUiRunStatusBadge :status="detail.summary.status" />
          </div>
          <div v-if="isRunning">
            <span>刷新状态</span>
            <strong>自动刷新中</strong>
          </div>
          <div>
            <span>浏览器</span>
            <strong>{{ formatBrowserType(detail.summary.browserType) }}</strong>
          </div>
          <div>
            <span>执行来源</span>
            <strong>{{ formatExecutionLocation(executionLocation) }}</strong>
          </div>
          <div>
            <span>耗时</span>
            <strong>{{ formatDurationMs(detail.summary.durationMs) }}</strong>
          </div>
          <div>
            <span>步骤</span>
            <strong>{{ detail.summary.passedSteps }} / {{ detail.summary.failedSteps }} / {{ detail.summary.skippedSteps }}</strong>
          </div>
          <div>
            <span>开始时间</span>
            <strong>{{ formatWebUiDateTime(detail.summary.startedAt) }}</strong>
          </div>
          <div>
            <span>报告 ID</span>
            <strong>{{ detail.summary.id }}</strong>
          </div>
          <div>
            <span>所属批次</span>
            <strong>{{ detail.summary.batchId || '-' }}</strong>
          </div>
        </section>

        <section class="web-ui-run-context">
          <header>
            <div>
              <span>执行上下文</span>
              <strong>{{ detail.context?.environment?.name || detail.summary.environmentName || '用例默认配置' }}</strong>
            </div>
            <small>变量值来自后端执行快照，敏感变量已脱敏。</small>
          </header>
          <dl>
            <div>
              <dt>Base URL</dt>
              <dd>{{ detail.context?.environment?.baseUrl || detail.summary.baseUrl || '-' }}</dd>
            </div>
            <div>
              <dt>变量集</dt>
              <dd>{{ detail.context?.variableSetName || '未使用变量集' }}</dd>
            </div>
            <div>
              <dt>执行来源</dt>
              <dd>{{ formatExecutionLocation(executionLocation) }}</dd>
            </div>
            <div>
              <dt>本地任务</dt>
              <dd>{{ localRunnerRunId || '-' }}</dd>
            </div>
            <div>
              <dt>浏览器</dt>
              <dd>{{ formatBrowserType(detail.context?.environment?.browserType || detail.summary.browserType) }}</dd>
            </div>
            <div>
              <dt>无头模式</dt>
              <dd>{{ formatBoolean(detail.context?.environment?.headless ?? detail.summary.headless) }}</dd>
            </div>
            <div>
              <dt>默认超时</dt>
              <dd>{{ detail.context?.environment?.defaultTimeoutMs ? `${detail.context.environment.defaultTimeoutMs} ms` : '-' }}</dd>
            </div>
            <div>
              <dt>变量数量</dt>
              <dd>{{ contextVariables.length }} 个</dd>
            </div>
          </dl>
          <div v-if="contextVariables.length" class="web-ui-run-context__variables">
            <span
              v-for="[name, value] in contextVariables"
              :key="name"
            >
              {{ name }}={{ value || '空值' }}
            </span>
          </div>
        </section>

        <el-alert
          v-if="detail.summary.failureSummary"
          class="web-ui-run-detail__failure"
          :title="detail.summary.failureSummary"
          type="error"
          show-icon
          :closable="false"
        />

        <section v-if="failedSteps.length" class="web-ui-run-evidence">
          <header class="web-ui-run-evidence__header">
            <div>
              <span>失败证据</span>
              <strong>{{ failedSteps.length }} 个失败步骤</strong>
            </div>
            <small>优先检查定位器、输入值、错误信息和截图证据。</small>
          </header>

          <article
            v-for="step in failedSteps"
            :key="step.id"
            class="web-ui-run-evidence-card"
          >
            <div class="web-ui-run-evidence-card__title">
              <div>
                <span>第 {{ step.sortOrder }} 步</span>
                <strong>{{ step.stepName || formatStepType(step.stepType) }}</strong>
              </div>
              <AppButton size="small" type="primary" @click="locateStep(step)">定位步骤</AppButton>
            </div>
            <dl>
              <div>
                <dt>步骤类型</dt>
                <dd>{{ formatStepType(step.stepType) }}</dd>
              </div>
              <div>
                <dt>定位器</dt>
                <dd>{{ formatStepLocator(step) }}</dd>
              </div>
              <div>
                <dt>输入/目标</dt>
                <dd>{{ formatStepInput(step) }}</dd>
              </div>
              <div>
                <dt>错误信息</dt>
                <dd class="web-ui-run-evidence-card__error">{{ step.errorMessage || '-' }}</dd>
              </div>
            </dl>
            <div
              v-if="step.screenshotUrl"
              class="web-ui-run-evidence-card__screenshot"
            >
              <el-button size="small" type="primary" :icon="Picture" tag="a" :href="step.screenshotUrl" target="_blank">
                打开失败截图
              </el-button>
              <el-button size="small" :icon="Download" tag="a" :href="step.screenshotUrl" download>
                下载截图
              </el-button>
            </div>
          </article>
        </section>

        <el-table
          class="web-ui-run-step-table"
          :data="detail.steps"
          border
          row-key="id"
          :row-class-name="getStepRowClassName"
          empty-text="暂无步骤结果"
        >
          <el-table-column type="expand" width="48">
            <template #default="{ row }">
              <div class="web-ui-run-step-detail">
                <dl>
                  <div>
                    <dt>步骤类型</dt>
                    <dd>{{ formatStepType(row.stepType) }}</dd>
                  </div>
                  <div>
                    <dt>定位器</dt>
                    <dd>{{ formatStepLocator(row) }}</dd>
                  </div>
                  <div>
                    <dt>输入/目标</dt>
                    <dd>{{ formatStepInput(row) }}</dd>
                  </div>
                  <div>
                    <dt>耗时</dt>
                    <dd>{{ formatDurationMs(row.durationMs) }}</dd>
                  </div>
                  <div class="web-ui-run-step-detail__wide">
                    <dt>错误信息</dt>
                    <dd>{{ row.errorMessage || '-' }}</dd>
                  </div>
                  <div class="web-ui-run-step-detail__wide">
                    <dt>截图证据</dt>
                    <dd>
                      <div v-if="row.screenshotUrl" class="web-ui-run-step-detail__evidence-actions">
                        <el-button size="small" :icon="Picture" tag="a" :href="row.screenshotUrl" target="_blank">打开截图</el-button>
                        <el-button size="small" :icon="Download" tag="a" :href="row.screenshotUrl" download>下载截图</el-button>
                      </div>
                      <span v-else>-</span>
                    </dd>
                  </div>
                </dl>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="#" width="56" align="center">
            <template #default="{ row }">
              {{ row.sortOrder }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" step />
            </template>
          </el-table-column>
          <el-table-column prop="stepName" label="步骤名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              {{ formatStepType(row.stepType) }}
            </template>
          </el-table-column>
          <el-table-column label="定位" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatStepLocator(row) }}
            </template>
          </el-table-column>
          <el-table-column prop="inputValueSnapshot" label="输入/目标" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatStepInput(row) }}
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="96">
            <template #default="{ row }">
              {{ formatDurationMs(row.durationMs) }}
            </template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="错误信息" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.errorMessage || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="证据" width="96">
            <template #default="{ row }">
              <el-tag v-if="row.screenshotUrl" type="warning" effect="light">有截图</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="定位" width="96" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="isFailedStep(row)"
                link
                type="primary"
                @click="locateStep(row)"
              >
                定位步骤
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>

    <template #footer>
      <div class="web-ui-run-detail__footer">
        <AppButton @click="closeDrawer">关闭</AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-run-detail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-run-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-run-actions > div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-run-actions__buttons {
  justify-content: flex-end;
}

.web-ui-run-actions span {
  padding: 2px var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-run-summary > div {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-run-summary span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-run-context {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-md);
  background: #eff6ff;
}

.web-ui-run-context header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-run-context header div {
  display: grid;
  min-width: 0;
  gap: var(--app-space-1);
}

.web-ui-run-context header span,
.web-ui-run-context header small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-context header strong {
  overflow-wrap: anywhere;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-run-context dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin: 0;
}

.web-ui-run-context dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-context dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-run-context__variables {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-run-context__variables span {
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 2px var(--app-space-2);
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-detail__failure {
  margin-top: calc(var(--app-space-2) * -1);
}

.web-ui-run-evidence {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: #fff7f7;
}

.web-ui-run-evidence__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-run-evidence__header div {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-run-evidence__header span,
.web-ui-run-evidence__header small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-evidence__header strong {
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-run-evidence-card {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-run-evidence-card__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-run-evidence-card__title div {
  display: grid;
  min-width: 0;
  gap: var(--app-space-1);
}

.web-ui-run-evidence-card__title span {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-evidence-card__title strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-run-evidence-card dl,
.web-ui-run-step-detail dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin: 0;
}

.web-ui-run-evidence-card dl > div,
.web-ui-run-step-detail dl > div {
  min-width: 0;
}

.web-ui-run-evidence-card dt,
.web-ui-run-step-detail dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-run-evidence-card dd,
.web-ui-run-step-detail dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.web-ui-run-evidence-card__error {
  color: var(--app-danger);
}

.web-ui-run-evidence-card__screenshot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  justify-self: flex-start;
}

.web-ui-run-evidence-card__screenshot .el-button + .el-button,
.web-ui-run-step-detail__evidence-actions .el-button + .el-button {
  margin-left: 0;
}

.web-ui-run-step-detail__evidence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-run-step-table {
  width: 100%;
}

.web-ui-run-step-table :deep(.web-ui-run-step-table__row--failed > td) {
  background: #fff7f7;
}

.web-ui-run-step-detail {
  padding: var(--app-space-3) var(--app-space-4);
}

.web-ui-run-step-detail__wide {
  grid-column: 1 / -1;
}

.web-ui-run-detail__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .web-ui-run-summary,
  .web-ui-run-context dl {
    grid-template-columns: 1fr;
  }

  .web-ui-run-context header {
    flex-direction: column;
  }
}
</style>
