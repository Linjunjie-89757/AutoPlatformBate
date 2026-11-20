<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, RefreshCw } from '@lucide/vue'

import { apiAutomationApi, type ApiAutomationEnvironmentItem, type ApiScenarioRunHistoryDetail, type ApiScenarioRunHistoryItem } from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

const props = defineProps<{
  scenarioId: number | null
  workspaceCode: string
  environments: ApiAutomationEnvironmentItem[]
}>()

const columns = ['开始时间', '环境', '步骤通过/总数', '耗时', '触发方式', '执行人', '状态', '操作']
const rows = ref<ApiScenarioRunHistoryItem[]>([])
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)
const error = ref('')
const detailOpen = ref(false)
const detail = ref<ApiScenarioRunHistoryDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
let listRequest = 0
let detailRequest = 0

async function loadHistory(pageNo = 1) {
  const request = ++listRequest
  error.value = ''
  if (props.scenarioId === null) {
    rows.value = []
    page.value = 1
    totalPages.value = 1
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await apiAutomationApi.getScenarioRunHistory(props.workspaceCode, props.scenarioId, { pageNo, pageSize: 20 })
    if (request !== listRequest) return
    rows.value = result.items
    page.value = result.pageNo
    totalPages.value = Math.max(1, result.totalPages)
  } catch (cause) {
    if (request === listRequest) error.value = getRequestErrorMessage(cause)
  } finally {
    if (request === listRequest) loading.value = false
  }
}

async function openDetail(row: ApiScenarioRunHistoryItem) {
  const request = ++detailRequest
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  detailError.value = ''
  try {
    const result = await apiAutomationApi.getScenarioRunHistoryDetail(props.workspaceCode, row.id)
    if (request === detailRequest) detail.value = result
  } catch (cause) {
    if (request === detailRequest) detailError.value = getRequestErrorMessage(cause)
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

watch(() => [props.workspaceCode, props.scenarioId], () => {
  ++detailRequest
  detailOpen.value = false
  rows.value = []
  page.value = 1
  void loadHistory()
}, { immediate: true })

function status(result: string | null) {
  switch (result?.toUpperCase()) {
    case 'PASS': case 'PASSED': case 'SUCCESS': return { label: '通过', kind: 'pass' }
    case 'FAIL': case 'FAILED': case 'ERROR': return { label: '失败', kind: 'fail' }
    case 'CANCELED': case 'CANCELLED': return { label: '已取消', kind: 'neutral' }
    case 'SKIPPED': return { label: '已跳过', kind: 'neutral' }
    case 'RUNNING': return { label: '运行中', kind: 'neutral' }
    default: return { label: result || '—', kind: 'neutral' }
  }
}

function environmentName(id: number | null) {
  return props.environments.find(item => item.id === id)?.name ?? (id === null ? '—' : '#' + id)
}

function duration(ms: number | null) {
  if (ms === null) return '—'
  return ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(2) + ' s'
}
</script>

<template>
  <section class="scene-history" aria-label="场景运行历史">
    <header class="scene-history__header">
      <b>运行记录</b>
      <button type="button" :disabled="loading || scenarioId === null" @click="loadHistory(page)">
        <RefreshCw :size="12" />刷新
      </button>
    </header>
    <p v-if="scenarioId === null" class="scene-history__message">场景保存并运行后，记录会显示在这里</p>
    <p v-else-if="loading" class="scene-history__message" role="status">正在加载运行记录…</p>
    <p v-else-if="error" class="scene-history__message" role="alert">运行记录加载失败。{{ error }}</p>
    <p v-else-if="!rows.length" class="scene-history__message">暂无运行记录</p>
    <div v-else class="scene-history__table">
      <table>
        <thead><tr><th v-for="column in columns" :key="column" scope="col">{{ column }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.createdAt?.replace('T', ' ').slice(0, 19) || '—' }}</td>
            <td>{{ environmentName(row.environmentId) }}</td>
            <td><b v-if="row.successCount !== null" :class="row.failedCount ? 'is-fail' : 'is-pass'">{{ row.successCount }}</b><span v-else>—</span> / {{ row.totalCount ?? '—' }}</td>
            <td>{{ duration(row.durationMs) }}</td>
            <td>—</td>
            <td>{{ row.operatorName || '—' }}</td>
            <td><span :class="'is-' + status(row.result).kind">{{ status(row.result).label }}</span></td>
            <td><button type="button" aria-label="查看详情" title="查看详情" @click="openDetail(row)"><Eye :size="14" /></button></td>
          </tr>
        </tbody>
      </table>
      <footer v-if="totalPages > 1">
        <button type="button" :disabled="page <= 1" @click="loadHistory(page - 1)">上一页</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button type="button" :disabled="page >= totalPages" @click="loadHistory(page + 1)">下一页</button>
      </footer>
    </div>
    <AppDrawer v-model="detailOpen" variant="standard" size="640px" title="场景运行详情">
      <div class="scene-history__detail">
        <p v-if="detailLoading" role="status">正在加载运行详情…</p>
        <p v-else-if="detailError" role="alert">运行详情加载失败。{{ detailError }}</p>
        <template v-else-if="detail">
          <h3>{{ detail.scenarioName }}</h3>
          <p :class="'is-' + status(detail.result).kind">{{ status(detail.result).label }} · {{ duration(detail.durationMs) }}</p>
          <p v-if="detail.failureSummary">{{ detail.failureSummary }}</p>
          <p v-if="!detail.stepResults.length">暂无步骤结果</p>
          <ol v-else>
            <li v-for="step in detail.stepResults" :key="step.stepKey || step.stepOrder">
              <b>{{ step.stepName }}</b>
              <span :class="step.success ? 'is-pass' : 'is-fail'">{{ step.success ? '通过' : '失败' }} · {{ duration(step.durationMs) }}</span>
              <p v-if="step.errorMessage">{{ step.errorMessage }}</p>
            </li>
          </ol>
        </template>
      </div>
    </AppDrawer>
  </section>
</template>

<style scoped>
.scene-history { min-height: 0; flex: 1; overflow: auto; padding: 20px; color: #4e5969; font: 400 12px/18px var(--scene-editor-font); }
.scene-history__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.scene-history__header b { color: #1d2129; font-size: 13px; font-weight: 600; }
.scene-history button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 3px 8px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: inherit; font: inherit; cursor: pointer; }
.scene-history button:disabled { opacity: .5; cursor: not-allowed; }
.scene-history__message { margin-top: 32px; text-align: center; color: #86909c; }
.scene-history__table { overflow-x: auto; }
.scene-history table { width: 100%; border-collapse: collapse; white-space: nowrap; }
.scene-history th { padding: 10px 16px; background: #f4f6fa; color: #86909c; text-align: left; font-weight: 500; }
.scene-history td { padding: 12px 16px; border-bottom: 1px solid #e5e6eb; }
.scene-history tr:nth-child(even) td { background: #fafbfe; }
.scene-history :is(th, td):last-child { text-align: right; }
.scene-history td button { border-color: transparent; background: transparent; }
.scene-history td button:hover { background: #e8f3ff; color: #165dff; }
.scene-history footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.scene-history__detail { flex: 1; overflow: auto; padding: 20px; color: #4e5969; font-size: 13px; }
.scene-history__detail h3 { margin-top: 0; color: #1d2129; }
.scene-history__detail li { padding-block: 8px; border-bottom: 1px solid #e5e6eb; }
.scene-history__detail li span { margin-left: 12px; }
.scene-history__detail li p { margin: 4px 0 0; overflow-wrap: anywhere; }
.is-pass { color: #00b42a; }
.is-fail { color: #f53f3f; }
.is-neutral { color: #86909c; }
</style>
