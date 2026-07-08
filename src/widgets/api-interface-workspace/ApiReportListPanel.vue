<script setup lang="ts">
import { computed } from 'vue'
import { Search as LucideSearch } from '@lucide/vue'
import type {
  ApiAutomationReportAnalysis,
  ApiAutomationReportItem,
  ApiAutomationReportStatistics,
} from '@/entities/api-automation'

type ApiReportArchiveFilter = 'active' | 'archived' | 'all'

const props = defineProps<{
  keyword: string
  objectType: string
  result: string
  archiveFilter: ApiReportArchiveFilter
  createdRange: [string, string] | null
  exporting: boolean
  analysis: ApiAutomationReportAnalysis | null
  analysisLoading: boolean
  statistics: ApiAutomationReportStatistics | null
  statisticsLoading: boolean
  items: ApiAutomationReportItem[]
  total: number
  pageNo: number
  pageSize: number
  actionLoadingKey: string
  formatDateTime: (value?: string | null) => string
  formatDuration: (value?: number | null) => string
  runResultClass: (value?: string | null) => string
  runResultLabel: (value?: string | null) => string
  reportObjectTypeLabel: (value?: string | null) => string
  reportPassedText: (item: Pick<ApiAutomationReportItem, 'successCount' | 'totalCount' | 'statusCode'>) => string
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:objectType': [value: string]
  'update:result': [value: string]
  'update:archiveFilter': [value: ApiReportArchiveFilter]
  'update:createdRange': [value: [string, string] | null]
  'update:pageNo': [value: number]
  'update:pageSize': [value: number]
  search: []
  'page-change': [value: number]
  'size-change': [value: number]
  reset: []
  refresh: []
  export: []
  open: [item: ApiAutomationReportItem]
  rerun: [item: ApiAutomationReportItem]
  archive: [item: ApiAutomationReportItem]
}>()

const analysisSummaryRows = computed(() => [
  { label: '运行总数', value: String(props.analysis?.totalCount ?? 0), tone: 'neutral' },
  { label: '失败数', value: String(props.analysis?.failedCount ?? 0), tone: (props.analysis?.failedCount ?? 0) > 0 ? 'danger' : 'neutral' },
  { label: '失败率', value: reportFailureRateText(props.analysis?.failureRate), tone: (props.analysis?.failureRate ?? 0) > 0 ? 'danger' : 'neutral' },
  { label: '平均耗时', value: props.formatDuration(props.analysis?.averageDurationMs), tone: 'neutral' },
])

function reportFailureRateText(value?: number | null) {
  if (value == null) return '0%'
  const normalized = value > 1 ? value : value * 100
  return `${normalized.toFixed(normalized >= 10 || normalized === 0 ? 0 : 1)}%`
}

function reportTrendBarWidth(totalCount?: number | null) {
  const maxCount = Math.max(1, ...(props.statistics?.trendPoints.map(point => point.totalCount) ?? [1]))
  return `${Math.max(4, Math.round(((totalCount ?? 0) / maxCount) * 100))}%`
}

function reportFailureRateWidth(value?: number | null) {
  const normalized = value == null ? 0 : value > 1 ? value : value * 100
  return `${Math.max(0, Math.min(100, normalized))}%`
}

function reportDistributionWidth(count?: number | null, source: 'result' | 'objectType' = 'result') {
  const items = source === 'result'
    ? props.statistics?.resultDistribution
    : props.statistics?.objectTypeDistribution
  const maxCount = Math.max(1, ...(items?.map(item => item.count) ?? [1]))
  return `${Math.max(4, Math.round(((count ?? 0) / maxCount) * 100))}%`
}

function searchByKeyword(keyword: string) {
  emit('update:keyword', keyword)
  emit('search')
}

function openReport(item: ApiAutomationReportItem) {
  emit('open', item)
}

function updatePageNo(value: number) {
  emit('update:pageNo', value)
}

function updatePageSize(value: number) {
  emit('update:pageSize', value)
}

function changePage(value: number) {
  emit('page-change', value)
}

function changePageSize(value: number) {
  emit('size-change', value)
}
</script>

<template>
  <div class="api-report-toolbar">
    <el-input
      :model-value="keyword"
      class="api-report-search"
      clearable
      placeholder="搜索报告、对象或执行人"
      @update:model-value="(value: string) => emit('update:keyword', value)"
      @keyup.enter="emit('search')"
      @clear="emit('search')"
    >
      <template #prefix>
        <LucideSearch class="api-search-prefix-icon" />
      </template>
    </el-input>
    <el-select
      :model-value="objectType"
      class="api-report-filter"
      placeholder="全部类型"
      clearable
      @update:model-value="(value: string) => emit('update:objectType', value || '')"
      @change="emit('search')"
    >
      <el-option label="接口用例" value="API_CASE" />
      <el-option label="场景" value="SCENARIO" />
      <el-option label="执行套件" value="SUITE" />
    </el-select>
    <el-select
      :model-value="result"
      class="api-report-filter"
      placeholder="全部结果"
      clearable
      @update:model-value="(value: string) => emit('update:result', value || '')"
      @change="emit('search')"
    >
      <el-option label="通过" value="SUCCESS" />
      <el-option label="失败" value="FAILED" />
      <el-option label="无断言" value="NO_ASSERTION" />
    </el-select>
    <el-select
      :model-value="archiveFilter"
      class="api-report-filter is-archive"
      @update:model-value="(value: ApiReportArchiveFilter) => emit('update:archiveFilter', value)"
      @change="emit('search')"
    >
      <el-option label="活跃报告" value="active" />
      <el-option label="归档报告" value="archived" />
      <el-option label="全部报告" value="all" />
    </el-select>
    <el-button :loading="exporting" @click="emit('export')">导出</el-button>
    <el-date-picker
      :model-value="createdRange"
      class="api-report-date-range"
      type="datetimerange"
      start-placeholder="开始时间"
      end-placeholder="结束时间"
      value-format="YYYY-MM-DDTHH:mm:ss"
      format="YYYY-MM-DD HH:mm"
      clearable
      @update:model-value="(value: [string, string] | null) => emit('update:createdRange', value)"
      @change="emit('search')"
    />
    <el-button type="primary" @click="emit('search')">查询</el-button>
    <el-button @click="emit('reset')">清空</el-button>
    <el-button @click="emit('refresh')">刷新</el-button>
  </div>

  <div class="api-report-analysis" v-loading="analysisLoading">
    <div class="api-report-analysis__summary">
      <div
        v-for="item in analysisSummaryRows"
        :key="item.label"
        :class="['api-report-analysis-card', `is-${item.tone}`]"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
    <div class="api-report-analysis__panel">
      <div class="api-report-analysis__title">
        <strong>失败原因</strong>
        <span>Top {{ analysis?.failureReasons.length || 0 }}</span>
      </div>
      <el-scrollbar v-if="analysis?.failureReasons.length" class="api-report-rank-list" max-height="96px">
        <button
          v-for="item in analysis.failureReasons"
          :key="item.key"
          type="button"
          class="api-report-rank-row"
          @click="searchByKeyword(item.label)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </button>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无失败原因</div>
    </div>
    <div class="api-report-analysis__panel">
      <div class="api-report-analysis__title">
        <strong>高频失败对象</strong>
        <span>Top {{ analysis?.topFailedObjects.length || 0 }}</span>
      </div>
      <el-scrollbar v-if="analysis?.topFailedObjects.length" class="api-report-rank-list" max-height="96px">
        <button
          v-for="item in analysis.topFailedObjects"
          :key="item.key"
          type="button"
          class="api-report-rank-row"
          @click="searchByKeyword(item.label)"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
          <small>{{ formatDuration(item.durationMs) }}</small>
        </button>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无失败对象</div>
    </div>
    <div class="api-report-analysis__panel">
      <div class="api-report-analysis__title">
        <strong>最近失败</strong>
        <span>{{ analysis?.recentFailures.length || 0 }} 条</span>
      </div>
      <el-scrollbar v-if="analysis?.recentFailures.length" class="api-report-recent-list" max-height="96px">
        <button
          v-for="item in analysis.recentFailures"
          :key="item.reportKey"
          type="button"
          class="api-report-recent-row"
          @click="emit('open', item)"
        >
          <span :class="['api-report-result', runResultClass(item.result)]">{{ runResultLabel(item.result) }}</span>
          <div>
            <strong>{{ item.objectName }}</strong>
          </div>
        </button>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无失败记录</div>
    </div>
  </div>

  <div class="api-report-statistics" v-loading="statisticsLoading">
    <section class="api-report-stat-panel is-trend">
      <div class="api-report-analysis__title">
        <strong>运行趋势</strong>
        <span>{{ statistics?.trendPoints.length || 0 }} 天</span>
      </div>
      <el-scrollbar v-if="statistics?.trendPoints.length" class="api-report-trend-list" max-height="132px">
        <div v-for="point in statistics.trendPoints" :key="point.date" class="api-report-trend-row">
          <span class="api-report-trend-date">{{ point.date }}</span>
          <div class="api-report-trend-bar">
            <i :style="{ width: reportTrendBarWidth(point.totalCount) }"></i>
            <em :style="{ width: reportFailureRateWidth(point.failureRate) }"></em>
          </div>
          <strong>{{ point.totalCount }}</strong>
          <small>失败 {{ point.failedCount }} · {{ reportFailureRateText(point.failureRate) }}</small>
        </div>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无趋势数据</div>
    </section>

    <section class="api-report-stat-panel">
      <div class="api-report-analysis__title">
        <strong>结果分布</strong>
        <span>{{ statistics?.resultDistribution.length || 0 }} 项</span>
      </div>
      <el-scrollbar v-if="statistics?.resultDistribution.length" class="api-report-distribution-list" max-height="132px">
        <div v-for="item in statistics.resultDistribution" :key="item.key" class="api-report-distribution-row">
          <span>{{ item.label }}</span>
          <div><i :style="{ width: reportDistributionWidth(item.count, 'result') }"></i></div>
          <strong>{{ item.count }}</strong>
        </div>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无结果分布</div>
    </section>

    <section class="api-report-stat-panel">
      <div class="api-report-analysis__title">
        <strong>对象类型</strong>
        <span>{{ statistics?.objectTypeDistribution.length || 0 }} 项</span>
      </div>
      <el-scrollbar v-if="statistics?.objectTypeDistribution.length" class="api-report-distribution-list" max-height="132px">
        <div v-for="item in statistics.objectTypeDistribution" :key="item.key" class="api-report-distribution-row">
          <span>{{ item.label }}</span>
          <div><i :style="{ width: reportDistributionWidth(item.count, 'objectType') }"></i></div>
          <strong>{{ item.count }}</strong>
        </div>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无对象类型</div>
    </section>

    <section class="api-report-stat-panel">
      <div class="api-report-analysis__title">
        <strong>慢运行</strong>
        <span>Top {{ statistics?.slowestRuns.length || 0 }}</span>
      </div>
      <el-scrollbar v-if="statistics?.slowestRuns.length" class="api-report-slowest-list" max-height="132px">
        <button
          v-for="item in statistics.slowestRuns"
          :key="item.reportKey"
          type="button"
          class="api-report-slowest-row"
          @click="emit('open', item)"
        >
          <span>{{ reportObjectTypeLabel(item.objectType) }}</span>
          <strong>{{ item.objectName }}</strong>
          <small>{{ formatDuration(item.durationMs) }}</small>
        </button>
      </el-scrollbar>
      <div v-else class="api-report-analysis-empty">暂无慢运行数据</div>
    </section>
  </div>

  <div class="api-report-table-shell">
    <el-table
      :data="items"
      height="100%"
      class="api-report-table"
      empty-text="暂无报告"
      @row-click="openReport"
    >
      <el-table-column label="结果" width="96">
        <template #default="{ row }">
          <span :class="['api-report-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">{{ reportObjectTypeLabel(row.objectType) }}</template>
      </el-table-column>
      <el-table-column label="执行对象" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <strong class="api-report-object">{{ row.objectName }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="通过" width="100">
        <template #default="{ row }">{{ reportPassedText(row) }}</template>
      </el-table-column>
      <el-table-column label="耗时" width="110">
        <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
      </el-table-column>
      <el-table-column label="环境" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.environmentName || '默认' }}</template>
      </el-table-column>
      <el-table-column label="变量集" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.variableSetName || '未选择' }}</template>
      </el-table-column>
      <el-table-column label="执行人" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.operatorName || '系统' }}</template>
      </el-table-column>
      <el-table-column label="执行时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="emit('open', row)">详情</el-button>
          <el-button
            link
            type="primary"
            :loading="actionLoadingKey === `rerun:${row.reportKey}`"
            @click.stop="emit('rerun', row)"
          >
            复跑
          </el-button>
          <el-button
            v-if="!row.archived"
            link
            type="warning"
            :loading="actionLoadingKey === `archive:${row.reportKey}`"
            @click.stop="emit('archive', row)"
          >
            归档
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <div class="api-report-pagination">
    <el-pagination
      :current-page="pageNo"
      :page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @update:current-page="updatePageNo"
      @update:page-size="updatePageSize"
      @current-change="changePage"
      @size-change="changePageSize"
    />
  </div>
</template>

<style scoped>
.api-report-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-report-search {
  width: 280px;
}

.api-report-filter {
  width: 136px;
}

.api-report-date-range {
  width: 330px;
}

.api-report-analysis {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr 1.1fr 1.2fr;
  gap: 10px;
  padding: 12px 16px 0;
}

.api-report-analysis__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.api-report-analysis-card,
.api-report-analysis__panel {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-analysis-card {
  display: flex;
  min-height: 54px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
}

.api-report-analysis-card span,
.api-report-analysis__title span,
.api-report-analysis-empty,
.api-report-rank-row small,
.api-report-recent-row small {
  color: #6b7280;
  font-size: 12px;
}

.api-report-analysis-card strong {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.api-report-analysis-card.is-danger strong {
  color: #b91c1c;
}

.api-report-analysis__panel {
  min-width: 0;
  overflow: hidden;
}

.api-report-analysis__title {
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid #f3f4f6;
}

.api-report-analysis__title strong {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.api-report-rank-list,
.api-report-recent-list {
  min-height: 0;
}

.api-report-rank-list :deep(.el-scrollbar__view),
.api-report-recent-list :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
}

.api-report-rank-row,
.api-report-recent-row {
  display: grid;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid #f8fafc;
  background: transparent;
  color: #111827;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-rank-row {
  grid-template-columns: minmax(0, 1fr) 36px 64px;
  padding: 0 10px;
}

.api-report-rank-row:not(:has(small)) {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.api-report-rank-row:hover,
.api-report-recent-row:hover {
  background: #f8fafc;
}

.api-report-rank-row span,
.api-report-recent-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-rank-row span {
  color: #374151;
  font-size: 12px;
}

.api-report-rank-row strong {
  justify-self: end;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
}

.api-report-rank-row small {
  justify-self: end;
}

.api-report-recent-row {
  grid-template-columns: 58px minmax(0, 1fr);
  padding: 6px 10px;
}

.api-report-recent-row > div {
  display: block;
  min-width: 0;
}

.api-report-recent-row strong {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.api-report-analysis-empty {
  display: flex;
  height: 96px;
  align-items: center;
  justify-content: center;
}

.api-report-statistics {
  display: grid;
  grid-template-columns: 1.5fr 0.9fr 0.9fr 1.1fr;
  gap: 10px;
  padding: 10px 16px 0;
}

.api-report-stat-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-trend-list,
.api-report-distribution-list,
.api-report-slowest-list {
  min-height: 0;
}

.api-report-trend-list :deep(.el-scrollbar__view),
.api-report-distribution-list :deep(.el-scrollbar__view),
.api-report-slowest-list :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
}

.api-report-trend-row {
  display: grid;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 78px minmax(0, 1fr) 36px 92px;
  padding: 0 10px;
  border-bottom: 1px solid #f8fafc;
}

.api-report-trend-date,
.api-report-trend-row small,
.api-report-distribution-row span,
.api-report-slowest-row span,
.api-report-slowest-row small {
  color: #6b7280;
  font-size: 12px;
}

.api-report-trend-bar,
.api-report-distribution-row div {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}

.api-report-trend-bar i,
.api-report-trend-bar em,
.api-report-distribution-row i {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: inherit;
}

.api-report-trend-bar i {
  background: #bfdbfe;
}

.api-report-trend-bar em {
  min-width: 0;
  background: #fca5a5;
}

.api-report-trend-row strong,
.api-report-distribution-row strong {
  justify-self: end;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.api-report-distribution-row {
  display: grid;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 64px minmax(0, 1fr) 36px;
  padding: 0 10px;
  border-bottom: 1px solid #f8fafc;
}

.api-report-distribution-row i {
  background: #93c5fd;
}

.api-report-slowest-row {
  display: grid;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 58px minmax(0, 1fr) 64px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid #f8fafc;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-slowest-row:hover {
  background: #f8fafc;
}

.api-report-slowest-row strong {
  overflow: hidden;
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-slowest-row small {
  justify-self: end;
}

.api-report-table-shell {
  min-height: 0;
  flex: 1;
  padding: 14px 16px 0;
}

.api-report-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.api-report-table :deep(.el-table__row) {
  cursor: pointer;
}

.api-report-object {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
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

.api-report-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--app-border);
  background: #fff;
}
</style>
