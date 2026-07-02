<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

import {
  formatWebUiDateTime,
  type WebUiElementValidateResultItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

type BatchValidateFilter = 'ALL' | 'FAILED'

interface BatchValidateSummary {
  totalCount: number
  passedCount: number
  failedCount: number
}

const props = defineProps<{
  modelValue: boolean
  summary: BatchValidateSummary
  filter: BatchValidateFilter
  results: WebUiElementValidateResultItem[]
  allResults?: WebUiElementValidateResultItem[]
  failedCount: number
  operating: boolean
  localRunnerOperating: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'filter-change': [filter: BatchValidateFilter]
  'preview-screenshot': [result: WebUiElementValidateResultItem]
  focus: [result: WebUiElementValidateResultItem]
  detail: [result: WebUiElementValidateResultItem]
  'copy-locator': [result: WebUiElementValidateResultItem]
  'reopen-runner-page': [result: WebUiElementValidateResultItem]
  retry: []
  'local-runner-validate-all': []
  'local-runner-validate-failed': []
}>()

const reportRows = computed(() => props.allResults?.length ? props.allResults : props.results)

function getFailureCategory(result: WebUiElementValidateResultItem) {
  if (result.matched) {
    return { label: '通过', tagType: 'success' as const, description: '' }
  }
  const message = (result.errorMessage || '').toLowerCase()
  const taskStatus = String(result.runnerTaskStatus || '').toUpperCase()
  if (taskStatus.includes('RUNNER_OFFLINE') || message.includes('offline') || message.includes('离线')) {
    return { label: '本地离线', tagType: 'danger' as const, description: '本地 Runner 未连接或任务执行期间离线，建议重新连接后再验证。' }
  }
  if (taskStatus.includes('TIMEOUT') || message.includes('timeout') || message.includes('timed out') || message.includes('超时')) {
    return { label: '超时', tagType: 'warning' as const, description: '页面加载或元素等待超时，建议检查网络、登录状态和等待时间。' }
  }
  if (message.includes('context') || message.includes('target page') || message.includes('browser has been closed') || message.includes('页面已失效')) {
    return { label: '页面不对', tagType: 'warning' as const, description: '本地页面已失效或已切换，建议重新打开目标页面后再验证。' }
  }
  if (result.matchCount > 1 || message.includes('strict mode') || message.includes('multiple') || message.includes('多匹配')) {
    return { label: '多匹配', tagType: 'warning' as const, description: '定位器匹配到多个元素，建议优先使用 Test ID、Role 或 Label 缩小范围。' }
  }
  if (result.matchCount === 0 || message.includes('not found') || message.includes('未找到') || message.includes('未匹配')) {
    return { label: '未找到', tagType: 'danger' as const, description: '当前页面没有匹配元素，建议确认本地页面、登录状态和定位器是否仍有效。' }
  }
  return { label: '验证失败', tagType: 'danger' as const, description: '建议查看失败原因和截图证据，确认页面状态与定位器是否匹配。' }
}

function getValidateFailureHint(result: WebUiElementValidateResultItem) {
  if (result.matched) return ''
  const category = getFailureCategory(result)
  if (category.description) return category.description
  const message = result.errorMessage || ''
  if (message.includes('Timeout') || message.includes('超时')) return '页面加载或元素出现超时，建议检查环境地址、登录状态和等待时间。'
  if (message.includes('not found') || message.includes('未找到')) return '未找到匹配元素，建议检查页面是否变化、定位器是否仍唯一有效。'
  if (message.includes('strict mode') || result.matchCount > 1) return '匹配到多个元素，建议改用更精确的 CSS、文本或角色定位。'
  if (message.includes('SyntaxError') || message.includes('selector')) return '定位器语法可能不正确，建议先在浏览器控制台或 Playwright 中验证。'
  return '建议查看截图和目标页面状态，确认元素是否可见、是否需要登录或前置操作。'
}

const traceInfo = computed(() => {
  const row = reportRows.value.find(item => item.validationSource === 'LOCAL_RUNNER' || item.runnerRunId || item.runnerPageUrl || item.validatedAt)
  if (!row) {
    return null
  }
  return {
    sourceLabel: row.validationSource === 'LOCAL_RUNNER' ? '本地页面验证' : '服务端验证',
    runnerRunId: row.runnerRunId || '-',
    runnerPageUrl: row.runnerPageUrl || '-',
    validatedAt: row.validatedAt || null,
    runnerTaskStatus: row.runnerTaskStatus || '-',
  }
})

const failedCategorySummary = computed(() => {
  const counts = new Map<string, number>()
  reportRows.value
    .filter(item => !item.matched)
    .forEach((item) => {
      const category = getFailureCategory(item).label
      counts.set(category, (counts.get(category) || 0) + 1)
    })
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
})

function formatReportValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function formatResultLocator(row: WebUiElementValidateResultItem) {
  if (!row.locatorValue) {
    return '-'
  }
  return row.locatorType ? `${row.locatorType}: ${row.locatorValue}` : row.locatorValue
}

function buildBatchValidateReport() {
  const failedRows = reportRows.value.filter(item => !item.matched)
  const categoryText = failedCategorySummary.value.length
    ? failedCategorySummary.value.map(item => `${item.label} ${item.count}`).join('，')
    : '无'
  const lines = [
    '# Web UI 本地批量验证报告',
    '',
    `- 验证来源：${formatReportValue(traceInfo.value?.sourceLabel)}`,
    `- runId：${formatReportValue(traceInfo.value?.runnerRunId)}`,
    `- 本地页面：${formatReportValue(traceInfo.value?.runnerPageUrl)}`,
    `- 验证完成：${formatWebUiDateTime(traceInfo.value?.validatedAt)}`,
    `- 任务状态：${formatReportValue(traceInfo.value?.runnerTaskStatus)}`,
    `- 总数：${props.summary.totalCount}`,
    `- 通过：${props.summary.passedCount}`,
    `- 失败：${props.summary.failedCount}`,
    `- 失败分类：${categoryText}`,
    '',
    '## 失败项',
  ]

  if (!failedRows.length) {
    lines.push('', '无失败项。')
    return lines.join('\n')
  }

  failedRows.forEach((row, index) => {
    const category = getFailureCategory(row)
    lines.push(
      '',
      `### ${index + 1}. ${formatReportValue(row.elementName)}`,
      '',
      `- 失败分类：${category.label}`,
      `- 定位器：${formatResultLocator(row)}`,
      `- 匹配数：${row.matchCount}`,
      `- 失败原因：${formatReportValue(row.errorMessage)}`,
      `- 排查建议：${getValidateFailureHint(row) || '-'}`,
      `- 本地页面：${formatReportValue(row.runnerPageUrl)}`,
      `- 验证时间：${formatWebUiDateTime(row.validatedAt)}`,
    )
  })

  return lines.join('\n')
}

async function copyBatchValidateReport() {
  if (!reportRows.value.length) {
    ElMessage.warning('暂无可复制的验证报告')
    return
  }
  try {
    await navigator.clipboard.writeText(buildBatchValidateReport())
    ElMessage.success('本次验证报告已复制')
  } catch {
    ElMessage.error('复制报告失败，请检查浏览器剪贴板权限')
  }
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="批量验证结果"
    size="900px"
    class="web-ui-element-batch-validate-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-scrollbar class="web-ui-element-batch-validate-scrollbar">
      <div class="web-ui-element-batch-validate">
        <div class="web-ui-element-batch-validate__summary">
          <el-tag type="info" effect="light">总数 {{ summary.totalCount }}</el-tag>
          <el-tag type="success" effect="light">通过 {{ summary.passedCount }}</el-tag>
          <el-tag type="danger" effect="light">失败 {{ summary.failedCount }}</el-tag>
        </div>

        <div v-if="traceInfo" class="web-ui-element-batch-validate__trace">
          <div>
            <span>验证来源</span>
            <strong>{{ traceInfo.sourceLabel }}</strong>
          </div>
          <div>
            <span>任务 runId</span>
            <strong>{{ traceInfo.runnerRunId }}</strong>
          </div>
          <div>
            <span>本地页面</span>
            <strong>{{ traceInfo.runnerPageUrl }}</strong>
          </div>
          <div>
            <span>验证完成</span>
            <strong>{{ formatWebUiDateTime(traceInfo.validatedAt) }}</strong>
          </div>
          <div>
            <span>任务状态</span>
            <strong>{{ traceInfo.runnerTaskStatus }}</strong>
          </div>
        </div>

        <div class="web-ui-element-batch-validate__filters">
          <AppButton size="small" :type="filter === 'ALL' ? 'primary' : 'default'" @click="emit('filter-change', 'ALL')">
            全部结果
          </AppButton>
          <AppButton size="small" :type="filter === 'FAILED' ? 'primary' : 'default'" @click="emit('filter-change', 'FAILED')">
            只看失败
          </AppButton>
        </div>

        <el-alert
          v-if="summary.failedCount > 0"
          type="warning"
          show-icon
          :closable="false"
        >
          <template #title>存在验证失败的元素</template>
          <p class="web-ui-element-batch-validate__alert-text">
            当前本地页面：{{ traceInfo?.runnerPageUrl || '-' }}。请先确认是否在正确页面验证，再查看失败分类和排查建议。
          </p>
          <div v-if="failedCategorySummary.length" class="web-ui-element-batch-validate__category-summary">
            <el-tag v-for="item in failedCategorySummary" :key="item.label" type="warning" effect="light">
              {{ item.label }} {{ item.count }}
            </el-tag>
          </div>
        </el-alert>
        <el-alert
          v-else-if="filter === 'FAILED'"
          type="success"
          show-icon
          :closable="false"
          title="当前批量验证没有失败项。"
        />

        <el-table
          :data="results"
          row-key="elementId"
          border
          empty-text="暂无批量验证结果"
        >
          <el-table-column label="结果" width="88">
            <template #default="{ row }">
              <el-tag :type="row.matched ? 'success' : 'danger'" effect="light">
                {{ row.matched ? '通过' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="失败分类" width="120">
            <template #default="{ row }">
              <el-tag
                v-if="!row.matched"
                :type="getFailureCategory(row).tagType"
                effect="light"
              >
                {{ getFailureCategory(row).label }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="elementName" label="元素名称" min-width="170" show-overflow-tooltip />
          <el-table-column label="来源" width="142">
            <template #default="{ row }">
              <el-tag :type="row.validationSource === 'LOCAL_RUNNER' ? 'primary' : 'info'" effect="light">
                {{ row.validationSource === 'LOCAL_RUNNER' ? '本地验证' : '服务端验证' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="匹配数" width="86">
            <template #default="{ row }">{{ row.matchCount }}</template>
          </el-table-column>
          <el-table-column label="验证时间" width="168">
            <template #default="{ row }">{{ formatWebUiDateTime(row.validatedAt) }}</template>
          </el-table-column>
          <el-table-column label="失败原因" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
          </el-table-column>
          <el-table-column label="本地页面" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ row.runnerPageUrl || '-' }}</template>
          </el-table-column>
          <el-table-column label="排查建议" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">{{ getValidateFailureHint(row) || '-' }}</template>
          </el-table-column>
          <el-table-column label="截图" width="86">
            <template #default="{ row }">
              <el-button
                v-if="row.screenshotBase64"
                link
                type="primary"
                @click="emit('preview-screenshot', row)"
              >
                查看
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="238" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="emit('focus', row)">定位</el-button>
              <el-button link type="primary" @click="emit('detail', row)">详情</el-button>
              <el-button
                link
                type="primary"
                :disabled="!row.locatorValue"
                @click="emit('copy-locator', row)"
              >
                复制定位器
              </el-button>
              <el-button
                link
                type="primary"
                :disabled="!row.runnerPageUrl"
                @click="emit('reopen-runner-page', row)"
              >
                重开页面
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-scrollbar>

    <template #footer>
      <div class="web-ui-element-batch-validate__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          :disabled="!reportRows.length"
          @click="copyBatchValidateReport"
        >
          复制本次报告
        </AppButton>
        <AppButton
          :loading="localRunnerOperating"
          :disabled="operating || !summary.totalCount"
          @click="emit('local-runner-validate-all')"
        >
          本地验证全部
        </AppButton>
        <AppButton
          :loading="localRunnerOperating"
          :disabled="operating || !failedCount"
          @click="emit('local-runner-validate-failed')"
        >
          本地验证失败项
        </AppButton>
        <AppButton
          type="primary"
          :loading="operating"
          :disabled="!failedCount"
          @click="emit('retry')"
        >
          重试失败项
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-batch-validate {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-batch-validate-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-element-batch-validate-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-element-batch-validate__summary,
.web-ui-element-batch-validate__filters,
.web-ui-element-batch-validate__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-batch-validate__summary,
.web-ui-element-batch-validate__filters {
  flex-wrap: wrap;
}

.web-ui-element-batch-validate__trace {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-element-batch-validate__trace div {
  min-width: 0;
}

.web-ui-element-batch-validate__trace span {
  display: block;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-element-batch-validate__trace strong {
  display: block;
  overflow-wrap: anywhere;
  color: var(--app-text);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-element-batch-validate__alert-text {
  margin: var(--app-space-1) 0 var(--app-space-2);
  color: var(--app-text-muted);
  line-height: 1.6;
}

.web-ui-element-batch-validate__category-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-element-batch-validate__footer {
  justify-content: flex-end;
}
</style>
