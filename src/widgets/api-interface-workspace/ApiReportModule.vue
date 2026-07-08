<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  apiAutomationApi,
  type ApiAutomationReportAnalysis,
  type ApiAutomationReportDetail,
  type ApiAutomationReportItem,
  type ApiAutomationReportStatistics,
  type ApiRunStepResult,
  type ApiRuntimeContextSnapshot,
} from '@/entities/api-automation'
import { buildLocalRunnerContextRows } from '@/entities/api-automation/lib/reportEvidence'
import { getRequestErrorMessage } from '@/shared/api/error'

import ApiReportDetailPanel from './ApiReportDetailPanel.vue'
import ApiReportListPanel from './ApiReportListPanel.vue'
import ApiReportStepDetailDrawer from './ApiReportStepDetailDrawer.vue'
import type { ApiReportTreeNode } from './apiReportDetailTypes'

type ApiReportArchiveFilter = 'active' | 'archived' | 'all'

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  reportKey?: string | null
  formatDateTime: (value?: string | null) => string
  formatDuration: (value?: number | null) => string
  formatResponseSize: (value?: number | null) => string
  runResultClass: (value?: string | null) => string
  runResultLabel: (value?: string | null) => string
}>()

const reportLoading = ref(false)
const reportItems = ref<ApiAutomationReportItem[]>([])
const reportTotal = ref(0)
const reportPageNo = ref(1)
const reportPageSize = ref(10)
const reportKeyword = ref('')
const reportObjectType = ref('')
const reportResult = ref('')
const reportArchiveFilter = ref<ApiReportArchiveFilter>('active')
const reportCreatedRange = ref<[string, string] | null>(null)
const reportAnalysis = ref<ApiAutomationReportAnalysis | null>(null)
const reportAnalysisLoading = ref(false)
const reportStatistics = ref<ApiAutomationReportStatistics | null>(null)
const reportStatisticsLoading = ref(false)
const reportDetailLoading = ref(false)
const reportDetailErrorMessage = ref('')
const selectedReportDetail = ref<ApiAutomationReportDetail | null>(null)
const expandedReportTreeKeys = ref<string[]>([])
const reportStepDetailDrawerVisible = ref(false)
const reportStepDetail = ref<ApiRunStepResult | null>(null)
const reportExporting = ref(false)
const reportActionLoadingKey = ref('')

function reportArchivedQueryValue() {
  if (reportArchiveFilter.value === 'all') return null
  return reportArchiveFilter.value === 'archived'
}

function currentReportQuery() {
  return {
    keyword: reportKeyword.value,
    objectType: reportObjectType.value,
    result: reportResult.value,
    createdFrom: reportCreatedRange.value?.[0],
    createdTo: reportCreatedRange.value?.[1],
    archived: reportArchivedQueryValue(),
  }
}

async function loadReports() {
  if (!props.workspaceReady) return
  reportLoading.value = true
  try {
    const page = await apiAutomationApi.getReports(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
      pageNo: reportPageNo.value,
      pageSize: reportPageSize.value,
    })
    reportItems.value = page.items
    reportTotal.value = page.total
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportLoading.value = false
  }
}

async function loadReportAnalysis() {
  if (!props.workspaceReady) return
  reportAnalysisLoading.value = true
  try {
    reportAnalysis.value = await apiAutomationApi.getReportAnalysis(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
    })
  } catch (error) {
    reportAnalysis.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportAnalysisLoading.value = false
  }
}

async function loadReportStatistics() {
  if (!props.workspaceReady) return
  reportStatisticsLoading.value = true
  try {
    reportStatistics.value = await apiAutomationApi.getReportStatistics(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
    })
  } catch (error) {
    reportStatistics.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportStatisticsLoading.value = false
  }
}

async function refreshReportWorkspace() {
  await Promise.all([loadReports(), loadReportAnalysis(), loadReportStatistics()])
}

function searchReports() {
  reportPageNo.value = 1
  void refreshReportWorkspace()
}

function resetReportFilters() {
  reportKeyword.value = ''
  reportObjectType.value = ''
  reportResult.value = ''
  reportArchiveFilter.value = 'active'
  reportCreatedRange.value = null
  reportPageNo.value = 1
  void refreshReportWorkspace()
}

async function openReportDetail(item: ApiAutomationReportItem) {
  if (!item.reportKey) return
  await openReportDetailByKey(item.reportKey, item.workspaceCode || props.workspaceCode || 'ALL')
}

async function openReportDetailByKey(reportKey: string, workspaceCode = props.workspaceCode || 'ALL') {
  if (!reportKey || selectedReportDetail.value?.reportKey === reportKey) return
  reportDetailLoading.value = true
  reportDetailErrorMessage.value = ''
  selectedReportDetail.value = null
  try {
    const detail = await apiAutomationApi.getReportDetail(workspaceCode, reportKey)
    selectedReportDetail.value = detail
    syncReportTreeExpansion(detail)
  } catch (error) {
    reportDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    reportDetailLoading.value = false
  }
}

function backToReportList() {
  selectedReportDetail.value = null
  expandedReportTreeKeys.value = []
  reportDetailErrorMessage.value = ''
  reportDetailLoading.value = false
}

function reportTreeStepKey(step: ApiRunStepResult, index: number) {
  return `step:${step.id ?? step.stepKey ?? step.stepOrder}:${index}`
}

function reportItemKey(item: ApiAutomationReportDetail['itemSnapshots'][number], index: number) {
  return `item:${item.sortOrder ?? index}:${item.itemType}:${item.itemId ?? index}`
}

function buildReportStepNode(step: ApiRunStepResult, index: number): ApiReportTreeNode {
  return {
    key: reportTreeStepKey(step, index),
    type: step.stepKind === 'SCENARIO_GROUP' ? 'scenario' : step.request ? 'request' : 'step',
    title: step.stepName || `步骤 ${step.stepOrder}`,
    subtitle: step.request?.url || `#${step.stepOrder}`,
    result: step.success ? 'SUCCESS' : 'FAILED',
    success: step.success,
    durationMs: step.durationMs,
    statusCode: step.response?.statusCode ?? null,
    failureSummary: step.errorMessage || null,
    step,
    children: [],
  }
}

function buildReportTree(detail: ApiAutomationReportDetail): ApiReportTreeNode[] {
  const steps = detail.stepResults || []
  if (!detail.itemSnapshots.length) {
    return [{
      key: `root:${detail.reportKey}`,
      type: detail.objectType === 'SCENARIO' ? 'scenario' : detail.objectType === 'API_CASE' ? 'request' : 'root',
      title: detail.objectName || detail.reportName || '执行报告',
      subtitle: reportObjectTypeLabel(detail.objectType),
      result: detail.result,
      success: detail.result ? !['FAILED', 'ERROR'].includes(String(detail.result).toUpperCase()) : null,
      durationMs: detail.durationMs,
      statusCode: detail.statusCode,
      failureSummary: detail.failureSummary,
      step: null,
      children: steps.map(buildReportStepNode),
    }]
  }

  const keyedSteps = new Map<string, ApiRunStepResult[]>()
  steps.forEach((step) => {
    if (step.suiteItemId == null && step.suiteItemOrder == null) return
    const key = `${step.suiteItemOrder ?? ''}-${step.suiteItemId ?? ''}`
    const rows = keyedSteps.get(key) || []
    rows.push(step)
    keyedSteps.set(key, rows)
  })

  let stepCursor = 0
  return detail.itemSnapshots.map((item, index) => {
    const stepCount = Math.max(0, Number(item.stepCount || 0))
    const itemStepKey = `${item.sortOrder ?? ''}-${item.itemId ?? ''}`
    let itemSteps = keyedSteps.get(itemStepKey) || []
    if (!itemSteps.length) {
      itemSteps = steps.slice(stepCursor, stepCursor + stepCount)
      stepCursor += stepCount
    }
    return {
      key: reportItemKey(item, index),
      type: item.itemType === 'SCENARIO' ? 'scenario' : 'request',
      title: item.itemName || `${reportObjectTypeLabel(item.itemType)} ${item.sortOrder ?? index + 1}`,
      subtitle: reportObjectTypeLabel(item.itemType),
      result: item.result,
      success: item.result ? !['FAILED', 'ERROR'].includes(String(item.result).toUpperCase()) : null,
      durationMs: item.durationMs,
      statusCode: null,
      failureSummary: item.failureSummary,
      step: null,
      children: itemSteps.map(buildReportStepNode),
    }
  })
}

function reportTreeContainsFailure(node: ApiReportTreeNode): boolean {
  return node.success === false || Boolean(node.failureSummary) || node.children.some(reportTreeContainsFailure)
}

function reportTreeNodeTypeLabel(node: ApiReportTreeNode) {
  if (node.type === 'scenario') return '场景'
  if (node.type === 'request') return '接口'
  if (node.type === 'step') return '步骤'
  return node.subtitle || '节点'
}

function syncReportTreeExpansion(detail: ApiAutomationReportDetail) {
  const keys = new Set<string>()
  const visit = (node: ApiReportTreeNode) => {
    if (node.children.length && reportTreeContainsFailure(node)) {
      keys.add(node.key)
    }
    node.children.forEach(visit)
  }
  buildReportTree(detail).forEach(visit)
  if (!keys.size) {
    const first = buildReportTree(detail)[0]
    if (first?.children.length) keys.add(first.key)
  }
  expandedReportTreeKeys.value = [...keys]
}

function toggleReportTreeNode(node: ApiReportTreeNode) {
  if (!node.children.length) {
    if (node.step) openReportStepDetail(node.step)
    return
  }
  const nextKeys = new Set(expandedReportTreeKeys.value)
  if (nextKeys.has(node.key)) {
    nextKeys.delete(node.key)
  } else {
    nextKeys.add(node.key)
  }
  expandedReportTreeKeys.value = [...nextKeys]
}

function openReportStepDetail(step: ApiRunStepResult) {
  reportStepDetail.value = step
  reportStepDetailDrawerVisible.value = true
}

const selectedReportContextSnapshot = computed<ApiRuntimeContextSnapshot | null>(() => {
  return parseRuntimeContextSnapshot(selectedReportDetail.value?.contextSnapshotJson)
})

const selectedReportLocalRunnerRows = computed(() => {
  return buildLocalRunnerContextRows(selectedReportContextSnapshot.value)
})

const selectedReportContextVariables = computed(() => {
  const variables = selectedReportContextSnapshot.value?.variables || {}
  return Object.entries(variables).map(([key, value]) => ({ key, value }))
})

const selectedReportContextVariableSetLabel = computed(() => {
  const variableSet = selectedReportContextSnapshot.value?.variableSet
  const name = variableSet?.name || selectedReportDetail.value?.variableSetName || ''
  if (!name) return '未使用变量集'
  return variableSet?.versionNo ? `${name} · v${variableSet.versionNo}` : name
})

const selectedReportContextVariableSetDetails = computed(() => {
  const variableSets = selectedReportContextSnapshot.value?.variableSets || []
  return variableSets
    .map(item => item.name ? (item.versionNo ? `${item.name} · v${item.versionNo}` : item.name) : '')
    .filter(Boolean)
})
const selectedReportTree = computed(() => selectedReportDetail.value ? buildReportTree(selectedReportDetail.value) : [])
const selectedReportSummaryRows = computed(() => selectedReportDetail.value ? reportDetailSummaryRows(selectedReportDetail.value) : [])

function parseRuntimeContextSnapshot(value?: string | null): ApiRuntimeContextSnapshot | null {
  if (!value) return null
  try {
    return JSON.parse(value) as ApiRuntimeContextSnapshot
  } catch {
    return null
  }
}

async function exportReports() {
  if (reportExporting.value) return
  reportExporting.value = true
  try {
    const blob = await apiAutomationApi.exportReports(props.workspaceCode || 'ALL', currentReportQuery())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-automation-reports-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('报告已导出')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportExporting.value = false
  }
}

async function rerunReport(item: ApiAutomationReportItem) {
  if (!item.reportKey || reportActionLoadingKey.value) return
  reportActionLoadingKey.value = `rerun:${item.reportKey}`
  try {
    await apiAutomationApi.rerunReport(item.workspaceCode || props.workspaceCode || 'ALL', item.reportKey, {
      workspaceCode: item.workspaceCode || props.workspaceCode || 'ALL',
      environmentId: item.environmentId,
      variableSetId: item.variableSetId,
      branchName: item.branchName,
      triggerSource: 'REPORT_RERUN',
    })
    ElMessage.success('复跑完成，已生成新的报告')
    reportPageNo.value = 1
    await refreshReportWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportActionLoadingKey.value = ''
  }
}

async function archiveReport(item: ApiAutomationReportItem) {
  if (!item.reportKey || item.archived || reportActionLoadingKey.value) return
  try {
    await ElMessageBox.confirm(`确定归档报告「${item.objectName}」吗？归档后默认列表和统计将不再展示。`, '归档报告', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  reportActionLoadingKey.value = `archive:${item.reportKey}`
  try {
    const archived = await apiAutomationApi.archiveReport(item.workspaceCode || props.workspaceCode || 'ALL', item.reportKey)
    if (selectedReportDetail.value?.reportKey === item.reportKey) {
      selectedReportDetail.value = archived
    }
    ElMessage.success('报告已归档')
    await refreshReportWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportActionLoadingKey.value = ''
  }
}

function handleReportPageChange(pageNo: number) {
  reportPageNo.value = pageNo
  void loadReports()
}

function handleReportPageSizeChange(pageSize: number) {
  reportPageSize.value = pageSize
  reportPageNo.value = 1
  void loadReports()
}

function reportObjectTypeLabel(value?: string | null) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'API_CASE') return '接口用例'
  if (normalized === 'SUITE') return '执行套件'
  if (normalized === 'SCENARIO') return '场景'
  return value || '-'
}

function reportPassedText(item: Pick<ApiAutomationReportItem, 'successCount' | 'totalCount' | 'statusCode'>) {
  if (item.totalCount != null) {
    return `${item.successCount ?? 0}/${item.totalCount}`
  }
  return item.statusCode == null ? '-' : `HTTP ${item.statusCode}`
}

function reportDetailSummaryRows(detail: ApiAutomationReportDetail) {
  return [
    ['对象类型', reportObjectTypeLabel(detail.objectType)],
    ['执行对象', detail.objectName || '-'],
    ['\u6240\u5c5e\u7a7a\u95f4', detail.workspaceName || detail.workspaceCode || '-'],
    ['执行结果', props.runResultLabel(detail.result)],
    ['\u901a\u8fc7\u6570', reportPassedText(detail)],
    ['\u5931\u8d25\u6570', String(detail.failedCount ?? 0)],
    ['\u8df3\u8fc7\u6570', String(detail.skippedCount ?? 0)],
    ['状态码', detail.statusCode == null ? '-' : String(detail.statusCode)],
    ['耗时', props.formatDuration(detail.durationMs)],
    ['响应大小', props.formatResponseSize(detail.responseSize)],
    ['执行环境', detail.environmentName || '默认'],
    ['\u53d8\u91cf\u96c6', detail.variableSetName || '\u672a\u9009\u62e9'],
    ['运行模式', detail.runMode || '-'],
    ['\u8fd0\u884c\u4e8e', detail.runOn || '-'],
    ['触发来源', detail.triggerSource || '-'],
    ['执行中', detail.operatorName || '系统'],
    ['执行时间', props.formatDateTime(detail.createdAt)],
  ].filter(([, value]) => value !== '-' || detail.objectType === 'SUITE')
}

watch(
  () => [props.workspaceCode, props.workspaceReady],
  () => {
    reportItems.value = []
    reportTotal.value = 0
    selectedReportDetail.value = null
    if (props.workspaceReady) {
      void refreshReportWorkspace()
    }
  },
  { immediate: true },
)

watch(
  () => [props.reportKey, props.workspaceCode, props.workspaceReady] as const,
  ([reportKey]) => {
    if (!props.workspaceReady || !reportKey) return
    void openReportDetailByKey(reportKey)
  },
  { immediate: true },
)
</script>

<template>
  <div class="api-report-workspace" v-loading="reportLoading && !selectedReportDetail && !reportDetailLoading">
    <ApiReportDetailPanel
      v-if="selectedReportDetail || reportDetailLoading || reportDetailErrorMessage"
      :detail="selectedReportDetail"
      :loading="reportDetailLoading"
      :error-message="reportDetailErrorMessage"
      :action-loading-key="reportActionLoadingKey"
      :summary-rows="selectedReportSummaryRows"
      :context-snapshot="selectedReportContextSnapshot"
      :context-variables="selectedReportContextVariables"
      :context-variable-set-label="selectedReportContextVariableSetLabel"
      :context-variable-set-details="selectedReportContextVariableSetDetails"
      :local-runner-rows="selectedReportLocalRunnerRows"
      :report-tree="selectedReportTree"
      :expanded-tree-keys="expandedReportTreeKeys"
      :format-date-time="formatDateTime"
      :format-duration="formatDuration"
      :run-result-class="runResultClass"
      :run-result-label="runResultLabel"
      :report-object-type-label="reportObjectTypeLabel"
      :report-tree-node-type-label="reportTreeNodeTypeLabel"
      @back="backToReportList"
      @rerun="rerunReport"
      @archive="archiveReport"
      @toggle-node="toggleReportTreeNode"
      @open-step="openReportStepDetail"
    />
    <ApiReportListPanel
      v-else
      v-model:keyword="reportKeyword"
      v-model:object-type="reportObjectType"
      v-model:result="reportResult"
      v-model:archive-filter="reportArchiveFilter"
      v-model:created-range="reportCreatedRange"
      v-model:page-no="reportPageNo"
      v-model:page-size="reportPageSize"
      :exporting="reportExporting"
      :analysis="reportAnalysis"
      :analysis-loading="reportAnalysisLoading"
      :statistics="reportStatistics"
      :statistics-loading="reportStatisticsLoading"
      :items="reportItems"
      :total="reportTotal"
      :action-loading-key="reportActionLoadingKey"
      :format-date-time="formatDateTime"
      :format-duration="formatDuration"
      :run-result-class="runResultClass"
      :run-result-label="runResultLabel"
      :report-object-type-label="reportObjectTypeLabel"
      :report-passed-text="reportPassedText"
      @search="searchReports"
      @page-change="handleReportPageChange"
      @size-change="handleReportPageSizeChange"
      @reset="resetReportFilters"
      @refresh="refreshReportWorkspace"
      @export="exportReports"
      @open="openReportDetail"
      @rerun="rerunReport"
      @archive="archiveReport"
    />
  </div>
  <ApiReportStepDetailDrawer
    v-model="reportStepDetailDrawerVisible"
    :step="reportStepDetail"
  />
</template>

<style scoped>
.api-report-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #f8fafc;
}
</style>
