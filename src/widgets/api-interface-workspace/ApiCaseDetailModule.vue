<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  apiAutomationApi,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiRunHistoryDetail,
  type ApiRunHistoryItem,
  type ApiRunStepResult,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

import ApiCaseDetailDrawer from './ApiCaseDetailDrawer.vue'
import ApiCaseDetailDrawerContent from './ApiCaseDetailDrawerContent.vue'
import {
  actualRequestPreviewFromConfig,
  assertionRunResultPresentation,
  buildActualRequestPreview,
  buildRunConsolePreview,
  inferResponseBodyLanguage,
  pickPreferredRunStep,
  runStepDebugError,
} from './lib/apiRunPreview'

type AnyFn = (...args: any[]) => any

type ApiCaseDrawerTab = 'detail' | 'history' | 'changes'
type ApiCaseDetailRequestTab = 'headers' | 'body' | 'params' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'
type ApiCaseHistoryView = 'list' | 'detail'
type ApiCaseHistoryResponseTab = 'body' | 'headers' | 'console' | 'actualRequest' | 'assertions'

const CASE_RUN_HISTORY_LIMIT = 10
const CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT = 40
const CASE_RUN_HISTORY_TABLE_ROW_HEIGHT = 54

const props = defineProps<{
  workspaceCode: string
  activeEditorName: string
  bodyModes: any[]
  paramTypeOptions: any[]
  assertionConditionLabel: AnyFn
  assertionResultClass: AnyFn
  assertionResultLabel: AnyFn
  assertionTypeLabel: AnyFn
  bodyLanguage: AnyFn
  enabledRows: AnyFn
  formatCaseTags: AnyFn
  formatDateTime: AnyFn
  formatDuration: AnyFn
  formatFileSize: AnyFn
  formatResponseSize: AnyFn
  getModeBodyText: AnyFn
  isRawBodyType: AnyFn
  pickCaseDetailDefaultRequestTab: AnyFn
  runResultClass: AnyFn
  runResultLabel: AnyFn
  statusTone: AnyFn
  toPrettyJson: AnyFn
}>()

const caseDetailDrawerVisible = ref(false)
const caseDetailDrawerTab = ref<ApiCaseDrawerTab>('detail')
const caseDetailRequestTab = ref<ApiCaseDetailRequestTab>('headers')
const caseDetailResponseTab = ref<ApiCaseHistoryResponseTab>('body')
const caseHistoryView = ref<ApiCaseHistoryView>('list')
const caseHistoryRequestTab = ref<'header' | 'body'>('header')
const caseHistoryResponseTab = ref<ApiCaseHistoryResponseTab>('body')
const viewingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const viewingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const viewingCaseDetailLoading = ref(false)
const viewingCaseDetailErrorMessage = ref('')
const caseRunHistories = ref<ApiRunHistoryItem[]>([])
const caseRunHistoryLoading = ref(false)
const caseRunHistoryErrorMessage = ref('')
const selectedCaseRunHistoryId = ref<number | null>(null)
const selectedCaseRunHistoryDetail = ref<ApiRunHistoryDetail | null>(null)
const caseRunHistoryDetailLoading = ref(false)
const caseRunHistoryDetailErrorMessage = ref('')

function resolveCaseItemWorkspaceCode(item?: ApiDefinitionCaseItem | null) {
  return (
    item?.workspaceCode
    || viewingCaseDetail.value?.workspaceCode
    || viewingCaseItem.value?.workspaceCode
    || props.workspaceCode
    || 'ALL'
  )
}

function latestCaseRunHistories(items: ApiRunHistoryItem[]) {
  return [...items]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, CASE_RUN_HISTORY_LIMIT)
}

async function loadViewingCaseDetail(caseId: number, workspaceCode = resolveCaseItemWorkspaceCode()) {
  viewingCaseDetailLoading.value = true
  viewingCaseDetailErrorMessage.value = ''
  try {
    const detail = await apiAutomationApi.getCaseDetail(workspaceCode, caseId)
    viewingCaseDetail.value = detail
    caseDetailRequestTab.value = props.pickCaseDetailDefaultRequestTab(detail)
  } catch (error) {
    viewingCaseDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    viewingCaseDetailLoading.value = false
  }
}

async function loadCaseRunHistories(caseId: number, workspaceCode = resolveCaseItemWorkspaceCode()) {
  caseRunHistoryLoading.value = true
  caseRunHistoryErrorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCaseRunHistory(workspaceCode, caseId, {
      pageNo: 1,
      pageSize: CASE_RUN_HISTORY_LIMIT,
    })
    caseRunHistories.value = latestCaseRunHistories(page.items)
    caseHistoryView.value = 'list'
    selectedCaseRunHistoryId.value = null
    selectedCaseRunHistoryDetail.value = null
    caseRunHistoryDetailErrorMessage.value = ''
  } catch (error) {
    caseRunHistoryErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryLoading.value = false
  }
}

async function openCaseRunHistoryDetail(item: ApiRunHistoryItem) {
  selectedCaseRunHistoryId.value = item.id
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseRunHistoryDetailLoading.value = true
  try {
    selectedCaseRunHistoryDetail.value = await apiAutomationApi.getCaseRunHistoryDetail(resolveCaseItemWorkspaceCode(), item.id)
  } catch (error) {
    caseRunHistoryDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryDetailLoading.value = false
  }
}

async function openCaseRunHistorySecondaryDetail(item: ApiRunHistoryItem) {
  caseHistoryView.value = 'detail'
  await openCaseRunHistoryDetail(item)
}

function backToCaseRunHistoryList() {
  caseHistoryView.value = 'list'
}

async function open(item: ApiDefinitionCaseItem) {
  viewingCaseItem.value = item
  viewingCaseDetail.value = null
  viewingCaseDetailErrorMessage.value = ''
  caseRunHistories.value = []
  caseRunHistoryErrorMessage.value = ''
  selectedCaseRunHistoryId.value = null
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseDetailDrawerTab.value = 'detail'
  caseDetailRequestTab.value = 'headers'
  caseDetailResponseTab.value = 'body'
  caseHistoryView.value = 'list'
  caseHistoryRequestTab.value = 'header'
  caseHistoryResponseTab.value = 'body'
  caseDetailDrawerVisible.value = true
  const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
  await Promise.all([
    loadViewingCaseDetail(item.id, targetWorkspaceCode),
    loadCaseRunHistories(item.id, targetWorkspaceCode),
  ])
}

async function refreshHistoriesIfViewing(item: ApiDefinitionCaseItem, workspaceCode = resolveCaseItemWorkspaceCode(item)) {
  if (caseDetailDrawerVisible.value && viewingCaseItem.value?.id === item.id) {
    await loadCaseRunHistories(item.id, workspaceCode)
  }
}

const caseDetailPreviewStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const selectedCaseHistoryStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const caseDetailBodyRawText = computed(() => viewingCaseDetail.value ? props.getModeBodyText(viewingCaseDetail.value.requestConfig.body) : '')
const caseDetailBodyLanguage = computed(() => props.bodyLanguage(viewingCaseDetail.value?.requestConfig.body.type))
const caseDetailResponseStatus = computed(() => caseDetailPreviewStep.value?.response?.statusCode ?? null)
const caseDetailResponseDuration = computed(() => caseDetailPreviewStep.value?.durationMs ?? null)
const caseDetailResponseBody = computed(() => props.toPrettyJson(caseDetailPreviewStep.value?.response?.body || caseDetailPreviewStep.value?.errorMessage || ''))
const caseDetailResponseBodyLanguage = computed(() =>
  inferResponseBodyLanguage(caseDetailPreviewStep.value?.response?.contentType, String(caseDetailPreviewStep.value?.response?.body || '')),
)
const caseDetailResponseHeaders = computed(() => JSON.stringify(caseDetailPreviewStep.value?.response?.headers ?? {}, null, 2))
const caseDetailResponseDebugError = computed(() => runStepDebugError(caseDetailPreviewStep.value))
const caseDetailResponseConsole = computed(() => buildRunConsolePreview(
  caseDetailResponseDebugError.value,
  caseDetailPreviewStep.value?.processorResults ?? [],
  caseDetailPreviewStep.value?.assertionResults ?? [],
  caseDetailPreviewStep.value?.extractionResults ?? [],
))
const caseDetailAssertionRows = computed(() => caseDetailPreviewStep.value?.assertionResults ?? [])
const caseDetailAssertionPresentation = computed(() =>
  assertionRunResultPresentation(caseDetailAssertionRows.value, caseDetailResponseDebugError.value),
)
const caseDetailResponseSize = computed(() => props.formatResponseSize(caseDetailPreviewStep.value?.response?.body ? new Blob([caseDetailPreviewStep.value.response.body]).size : 0))
const caseDetailActualRequest = computed(() => {
  if (caseDetailPreviewStep.value?.request) {
    return JSON.stringify(buildActualRequestPreview(caseDetailPreviewStep.value.request, null), null, 2)
  }
  if (!viewingCaseDetail.value) {
    return '-'
  }
  return JSON.stringify(actualRequestPreviewFromConfig(viewingCaseDetail.value.requestConfig, viewingCaseDetail.value.method, viewingCaseDetail.value.path), null, 2)
})
const caseHistoryRequestHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.request?.headers ?? {}, null, 2))
const caseHistoryRequestBody = computed(() => {
  const request = selectedCaseHistoryStep.value?.request
  if (!request) return '-'
  return props.toPrettyJson({
    queryParams: request.queryParams ?? [],
    cookies: request.cookies ?? [],
    bodyType: request.bodyType ?? null,
    bodyContentType: request.bodyContentType ?? null,
    bodyFormItems: request.bodyFormItems ?? [],
    bodyFileName: request.bodyFileName ?? null,
    bodyFileContentType: request.bodyFileContentType ?? null,
    body: request.body ?? null,
  })
})
const caseHistoryRequestBodyLanguage = computed(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.request?.bodyFileContentType, String(selectedCaseHistoryStep.value?.request?.body || '')),
)
const caseHistoryResponseBody = computed(() => props.toPrettyJson(selectedCaseHistoryStep.value?.response?.body || selectedCaseHistoryStep.value?.errorMessage || ''))
const caseHistoryResponseBodyLanguage = computed(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.response?.contentType, String(selectedCaseHistoryStep.value?.response?.body || '')),
)
const caseHistoryResponseHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.response?.headers ?? {}, null, 2))
const caseHistoryDebugError = computed(() => runStepDebugError(selectedCaseHistoryStep.value, null, selectedCaseRunHistoryDetail.value?.failureSummary))
const caseHistoryConsole = computed(() => buildRunConsolePreview(
  caseHistoryDebugError.value,
  selectedCaseHistoryStep.value?.processorResults ?? [],
  selectedCaseHistoryStep.value?.assertionResults ?? [],
  selectedCaseHistoryStep.value?.extractionResults ?? [],
))
const caseHistoryAssertionRows = computed(() => selectedCaseHistoryStep.value?.assertionResults ?? [])
const caseRunHistoryMeta = computed(() => {
  const detail = selectedCaseRunHistoryDetail.value
  return {
    environmentName: detail?.environmentName || '默认',
    variableSetName: detail?.variableSetName || '未选择',
    operator: detail?.operator || '-',
  }
})
const caseRunHistoryTableHeight = computed(() => (
  CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT
  + Math.max(caseRunHistories.value.length, 1) * CASE_RUN_HISTORY_TABLE_ROW_HEIGHT
))

defineExpose({
  open,
  refreshHistoriesIfViewing,
})
</script>

<template>
  <ApiCaseDetailDrawer
    v-model="caseDetailDrawerVisible"
    :title="viewingCaseItem?.name || '用例详情'"
    :subtitle="viewingCaseItem?.definitionName || activeEditorName || '-'"
    :method="viewingCaseItem?.method || '-'"
    :path="viewingCaseItem?.path || '未配置路径'"
    @request-close="caseDetailDrawerVisible = false"
  >
    <ApiCaseDetailDrawerContent
      :assertion-condition-label="assertionConditionLabel"
      :assertion-result-class="assertionResultClass"
      :assertion-result-label="assertionResultLabel"
      :assertion-type-label="assertionTypeLabel"
      :back-to-case-run-history-list="backToCaseRunHistoryList"
      :body-modes="bodyModes"
      :case-detail-assertion-presentation="caseDetailAssertionPresentation"
      :case-detail-assertion-rows="caseDetailAssertionRows"
      :case-detail-body-language="caseDetailBodyLanguage"
      :case-detail-body-raw-text="caseDetailBodyRawText"
      v-model:case-detail-drawer-tab="caseDetailDrawerTab"
      :case-detail-preview-step="caseDetailPreviewStep"
      v-model:case-detail-request-tab="caseDetailRequestTab"
      :case-detail-response-body="caseDetailResponseBody"
      :case-detail-response-body-language="caseDetailResponseBodyLanguage"
      :case-detail-response-console="caseDetailResponseConsole"
      :case-detail-response-duration="caseDetailResponseDuration"
      :case-detail-response-headers="caseDetailResponseHeaders"
      :case-detail-response-size="caseDetailResponseSize"
      :case-detail-response-status="caseDetailResponseStatus"
      v-model:case-detail-response-tab="caseDetailResponseTab"
      :case-detail-actual-request="caseDetailActualRequest"
      :case-history-assertion-rows="caseHistoryAssertionRows"
      :case-history-console="caseHistoryConsole"
      :case-history-request-body="caseHistoryRequestBody"
      :case-history-request-body-language="caseHistoryRequestBodyLanguage"
      :case-history-request-headers="caseHistoryRequestHeaders"
      v-model:case-history-request-tab="caseHistoryRequestTab"
      :case-history-response-body="caseHistoryResponseBody"
      :case-history-response-body-language="caseHistoryResponseBodyLanguage"
      :case-history-response-headers="caseHistoryResponseHeaders"
      v-model:case-history-response-tab="caseHistoryResponseTab"
      :case-history-view="caseHistoryView"
      :case-run-histories="caseRunHistories"
      :case-run-history-detail-error-message="caseRunHistoryDetailErrorMessage"
      :case-run-history-detail-loading="caseRunHistoryDetailLoading"
      :case-run-history-error-message="caseRunHistoryErrorMessage"
      :case-run-history-loading="caseRunHistoryLoading"
      :case-run-history-meta="caseRunHistoryMeta"
      :case-run-history-table-height="caseRunHistoryTableHeight"
      :enabled-rows="enabledRows"
      :format-case-tags="formatCaseTags"
      :format-date-time="formatDateTime"
      :format-duration="formatDuration"
      :format-file-size="formatFileSize"
      :format-response-size="formatResponseSize"
      :is-raw-body-type="isRawBodyType"
      :open-case-run-history-secondary-detail="openCaseRunHistorySecondaryDetail"
      :param-type-options="paramTypeOptions"
      :run-result-class="runResultClass"
      :run-result-label="runResultLabel"
      :selected-case-history-step="selectedCaseHistoryStep"
      :selected-case-run-history-detail="selectedCaseRunHistoryDetail"
      :status-tone="statusTone"
      :to-pretty-json="toPrettyJson"
      :viewing-case-detail="viewingCaseDetail"
      :viewing-case-detail-error-message="viewingCaseDetailErrorMessage"
      :viewing-case-detail-loading="viewingCaseDetailLoading"
      :viewing-case-item="viewingCaseItem"
    />
  </ApiCaseDetailDrawer>
</template>
