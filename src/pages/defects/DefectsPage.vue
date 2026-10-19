<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  dateRangeFromToday,
  defectApi,
  defectDateShortcuts,
  formatDate,
  type DefectClientFilter,
  type DefectStatistics,
} from '@/entities/defect'
import { hasWorkspacePermission, useSession } from '@/entities/session'
import {
  useWorkspaceContext,
  workspaceApi,
  type WorkspaceAssignableMemberItem,
  type WorkspaceItem,
} from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { DefectFilterPanel } from '@/widgets/defect-filter-panel'
import { DefectListPanel } from '@/widgets/defect-list-panel'
import { DefectSummaryPanel } from '@/widgets/defect-summary-panel'

const DefectStatusDonutChart = defineAsyncComponent(() => import('@/shared/ui/charts/DefectStatusDonutChart.vue'))
const DefectAssigneeBarChart = defineAsyncComponent(() => import('@/shared/ui/charts/DefectAssigneeBarChart.vue'))
const DefectTrendAreaChart = defineAsyncComponent(() => import('@/shared/ui/charts/DefectTrendAreaChart.vue'))

const route = useRoute()
const router = useRouter()
const { currentUser } = useSession()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceMembers = ref<WorkspaceAssignableMemberItem[]>([])
const workspaceLoading = ref(false)
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')
const statistics = ref<DefectStatistics | null>(null)
const filter = ref<DefectClientFilter>({
  keyword: '',
  status: '',
  priority: '',
  severity: '',
  assigneeId: '',
  workspaceCode: '',
  createdFrom: '',
  createdTo: '',
})
const listPanelRef = ref<InstanceType<typeof DefectListPanel> | null>(null)
const activeView = ref<'list' | 'stats'>('list')
const statsPreset = ref<'all' | 'week' | 'month' | 'custom'>('all')
const statsCustomRange = ref<[string, string] | undefined>(dateRangeFromToday(30))
const statsPresetOptions = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'custom', label: '自定义' },
] as const
const selectedDefectCount = ref(0)
let statisticsRequestSequence = 0
const canCreateDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.create'))
const canEditDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.edit'))
const canDeleteDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.delete'))
const canReviewDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.review'))

const statusDistributionItems = computed(() => {
  const source = statistics.value
  return [
    { name: '已关闭', value: source?.closed ?? 0, color: '#00B42A' },
    { name: '处理中', value: source?.inProgress ?? 0, color: '#FF7D00' },
    { name: '新建', value: source?.todo ?? 0, color: '#165DFF' },
    { name: '待验证', value: source?.pendingVerify ?? 0, color: '#FAAD14' },
    { name: '已指派', value: source?.assigned ?? 0, color: '#7816FF' },
    { name: '已驳回', value: source?.rejected ?? 0, color: '#F53F3F' },
  ]
})
const severityDistributionItems = computed(() => {
  const counts = new Map((statistics.value?.severityDistribution ?? []).map(item => [item.severity, item.count]))
  return [
    { name: '致命', value: counts.get('CRITICAL') ?? 0, color: '#F53F3F' },
    { name: '严重', value: counts.get('HIGH') ?? 0, color: '#FF7D00' },
    { name: '一般', value: counts.get('MEDIUM') ?? 0, color: '#FAAD14' },
    { name: '轻微', value: counts.get('LOW') ?? 0, color: '#86909C' },
  ]
})
const severityDistributionTotal = computed(() => severityDistributionItems.value.reduce((total, item) => total + item.value, 0))
const assigneeDistributionItems = computed(() => statistics.value?.assigneeDistribution ?? [])
const trendDistributionItems = computed(() => {
  const items = (statistics.value?.trend ?? []).map(item => ({
    day: item.date.slice(5),
    newCount: item.created,
    closedCount: item.closed,
  }))
  if (items.length <= 20) {
    return items
  }
  const step = Math.ceil(items.length / 15)
  return items.filter((_, index) => index % step === 0 || index === items.length - 1)
})

const statsCards = computed(() => [
  {
    label: '缺陷总数',
    value: statistics.value?.total ?? '—',
    note: statsPreset.value === 'all' ? '当前工作区统计' : '时间段内新增',
    tone: 'total',
    icon: figmaDefectIcons.stats.icon.total,
  },
  {
    label: '待处理',
    value: statistics.value
      ? (statistics.value.todo ?? 0) + (statistics.value.assigned ?? 0)
      : '—',
    note: '新建 + 已指派',
    tone: 'todo',
    icon: figmaDefectIcons.stats.icon.todo,
  },
  {
    label: '高优先级',
    value: statistics.value?.highPriority ?? '—',
    note: 'P0 + P1 缺陷',
    tone: 'high',
    icon: figmaDefectIcons.stats.icon.high,
  },
  {
    label: '待验证',
    value: statistics.value?.pendingVerify ?? '—',
    note: '开发已修复',
    tone: 'verify',
    icon: figmaDefectIcons.stats.icon.verify,
  },
])

const workspaceOptions = computed(() => {
  const options = workspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some((item) => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

const assigneeOptions = computed(() => workspaceMembers.value.map((item) => ({
  label: item.displayName || item.username || `用户 ${item.userId}`,
  value: String(item.userId),
})))

const workspaceFilterOptions = computed(() => workspaces.value
  .filter((item) => item.workspaceCode !== 'ALL')
  .map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  })))

const showWorkspaceFilter = computed(() => workspaceCode.value === 'ALL')
const businessWorkspaces = computed(() => workspaces.value.filter((item) => (
  item.workspaceCode
  && item.workspaceCode !== 'ALL'
  && !item.allScope
)))

const statsDateRange = computed<[string, string] | undefined>(() => {
  if (statsPreset.value === 'all') {
    return undefined
  }
  if (statsPreset.value === 'custom') {
    return statsCustomRange.value
  }

  const end = new Date()
  if (statsPreset.value === 'month') {
    return [formatDate(new Date(end.getFullYear(), end.getMonth(), 1)), formatDate(end)]
  }

  const start = new Date(end)
  start.setDate(end.getDate() - end.getDay())
  return [formatDate(start), formatDate(end)]
})

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  if (routeWorkspace && (routeWorkspace === 'ALL' || items.some(item => item.workspaceCode === routeWorkspace))) {
    return routeWorkspace
  }

  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some(item => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceReady.value = false
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    workspaceSelectorCode.value = workspaceCode.value
    setSelectedWorkspaceCode(workspaceCode.value)
  } catch (error) {
    workspaceCode.value = 'ALL'
    workspaceSelectorCode.value = 'ALL'
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
    workspaceReady.value = true
  }
}

async function loadStatistics() {
  const requestSequence = ++statisticsRequestSequence
  try {
    const range = statsDateRange.value
    const result = await defectApi.getDefectStatistics(
      workspaceCode.value,
      range ? { createdFrom: range[0], createdTo: range[1] } : undefined,
    )
    if (requestSequence === statisticsRequestSequence) {
      statistics.value = result
    }
  } catch {
    if (requestSequence === statisticsRequestSequence) {
      statistics.value = null
    }
  }
}

async function loadWorkspaceMembers() {
  if (!workspaceCode.value) {
    workspaceMembers.value = []
    filter.value = {
      ...filter.value,
      assigneeId: '',
    }
    return
  }

  try {
    if (workspaceCode.value === 'ALL') {
      const memberGroups = await Promise.allSettled(
        businessWorkspaces.value.map((workspace) => workspaceApi.getWorkspaceAssignableMembers(workspace.workspaceCode)),
      )
      const memberMap = new Map<number, WorkspaceAssignableMemberItem>()
      memberGroups.forEach((group) => {
        if (group.status !== 'fulfilled') {
          return
        }
        group.value.forEach((member) => {
          if (!memberMap.has(member.userId)) {
            memberMap.set(member.userId, member)
          }
        })
      })
      workspaceMembers.value = Array.from(memberMap.values())
      return
    }

    workspaceMembers.value = await workspaceApi.getWorkspaceAssignableMembers(workspaceCode.value)
  } catch {
    workspaceMembers.value = []
  }
}

async function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
  workspaceSelectorCode.value = value
  setSelectedWorkspaceCode(value)
  filter.value = {
    ...filter.value,
    assigneeId: '',
  }
  if (route.query.workspace !== value) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        workspace: value,
      },
      hash: route.hash,
    })
  }
  void loadWorkspaceMembers()
  void loadStatistics()
}

function handleCreateDefect() {
  if (!canCreateDefects.value) return
  listPanelRef.value?.openCreateDialog()
}

function handleDefectSelectionChange(count: number) {
  selectedDefectCount.value = count
}

function handleBatchAssignDefects() {
  if (!canEditDefects.value) return
  listPanelRef.value?.batchAssignSelectedDefects()
}

function handleBatchCloseDefects() {
  if (!canReviewDefects.value) return
  listPanelRef.value?.batchCloseSelectedDefects()
}

function handleBatchDeleteDefects() {
  if (!canDeleteDefects.value) return
  void listPanelRef.value?.deleteSelectedDefects()
}

function handleStatSelect(status: string) {
  filter.value = {
    ...filter.value,
    status,
  }
}

function resetFilters() {
  filter.value = {
    keyword: '',
    status: '',
    priority: '',
    severity: '',
    assigneeId: '',
    workspaceCode: '',
    createdFrom: '',
    createdTo: '',
  }
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await Promise.all([loadWorkspaceMembers(), loadStatistics()])
  })()
})

watch(
  selectedWorkspaceCode,
  (value) => {
    if (!workspaceReady.value || !value || value === workspaceCode.value) {
      return
    }
    if (value !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === value)) {
      return
    }
    void handleWorkspaceChange(value)
  },
)

watch(
  [statsPreset, statsCustomRange],
  () => {
    if (workspaceReady.value) {
      void loadStatistics()
    }
  },
  { deep: true },
)

watch(
  () => route.query.workspace,
  (value) => {
    const routeWorkspace = Array.isArray(value) ? value[0] : value
    if (!workspaceReady.value || !routeWorkspace || routeWorkspace === workspaceCode.value) {
      return
    }
    if (routeWorkspace !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === routeWorkspace)) {
      return
    }
    void handleWorkspaceChange(routeWorkspace)
  },
)

</script>

<template>
  <AppPage
    title="缺陷管理"
    description=""
    fill
  >
    <template #actions>
      <div class="defects-workspace-select">
        <span class="defects-workspace-select__label">工作空间</span>
        <el-select :suffix-icon="AppSelectChevron"
          v-model="workspaceSelectorCode"
          class="defects-workspace-select__control"
          :disabled="workspaceLoading"
          :loading="workspaceLoading"
          size="default"
          @change="handleWorkspaceChange"
        >
          <el-option
            v-for="item in workspaceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="workspaceErrorMessage" class="defects-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="defects-page">
      <nav class="defects-page__tabs" aria-label="缺陷管理视图">
        <button type="button" :class="{ 'is-active': activeView === 'list' }" @click="activeView = 'list'">
          缺陷列表
        </button>
        <button type="button" :class="{ 'is-active': activeView === 'stats' }" @click="activeView = 'stats'">
          统计视图
        </button>
      </nav>

      <template v-if="activeView === 'list'">
        <DefectSummaryPanel
          :statistics="statistics"
          :active-status="filter.status"
          :show-create-button="workspaceReady && canCreateDefects"
          @select="handleStatSelect"
          @create="handleCreateDefect"
        />

        <section class="defects-page__list-shell">
          <DefectFilterPanel
            v-model="filter"
            :workspace-code="workspaceCode"
            :workspace-options="workspaceFilterOptions"
            :assignee-options="assigneeOptions"
            :show-create-button="false"
            :show-workspace-filter="showWorkspaceFilter"
            :selected-count="selectedDefectCount"
            :can-edit="canEditDefects"
            :can-review="canReviewDefects"
            :can-delete="canDeleteDefects"
            embedded
            @reset="resetFilters"
            @create="handleCreateDefect"
            @batch-assign="handleBatchAssignDefects"
            @batch-close="handleBatchCloseDefects"
            @batch-delete="handleBatchDeleteDefects"
          />

          <DefectListPanel
            v-if="workspaceReady"
            ref="listPanelRef"
            :workspace-code="workspaceCode"
            :filter="filter"
            :assignee-options="assigneeOptions"
            :can-edit="canEditDefects"
            :can-review="canReviewDefects"
            :can-delete="canDeleteDefects"
            embedded
            @data-change="loadStatistics"
            @selection-change="handleDefectSelectionChange"
          />
        </section>
      </template>

      <section v-else class="defects-page__stats-view">
        <div class="defects-page__stats-filter" aria-label="统计时间范围">
          <span>时间范围</span>
          <div class="defects-page__stats-filter-options">
            <button
              v-for="item in statsPresetOptions"
              :key="item.key"
              type="button"
              :class="{ 'is-active': statsPreset === item.key }"
              @click="statsPreset = item.key"
            >
              {{ item.label }}
            </button>
          </div>
          <el-date-picker
            v-if="statsPreset === 'custom'"
            v-model="statsCustomRange"
            class="defects-page__stats-date-range"
            type="daterange"
            placeholder="选择日期范围"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
            :shortcuts="defectDateShortcuts"
          />
        </div>
        <header class="defects-page__stats-head">
          <h2>缺陷统计</h2>
        </header>
        <div class="defects-page__stats-cards">
          <article
            v-for="card in statsCards"
            :key="card.label"
            :class="`is-${card.tone}`"
          >
            <i><img :src="card.icon" alt="" /></i>
            <div>
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
              <small>{{ card.note }}</small>
            </div>
          </article>
        </div>
        <div class="defects-page__stats-grid">
          <article class="defects-page__chart-card">
            <h3>状态分布</h3>
            <div class="defects-page__chart-asset defects-page__chart-asset--status">
              <DefectStatusDonutChart
                v-if="statistics?.total"
                :items="statusDistributionItems"
              />
              <div v-else class="defects-page__chart-empty">
                {{ statistics ? '暂无缺陷数据' : '暂无状态统计数据' }}
              </div>
            </div>
          </article>
          <article class="defects-page__chart-card">
            <h3>严重程度分布</h3>
            <div class="defects-page__chart-asset defects-page__chart-asset--severity">
              <div
                v-if="statistics?.total"
                class="defects-page__severity-bars"
                role="img"
                aria-label="缺陷严重程度分布横向柱状图"
              >
                <div v-for="item in severityDistributionItems" :key="item.name" class="defects-page__severity-row">
                  <div class="defects-page__severity-meta">
                    <span>{{ item.name }}</span>
                    <strong :style="{ color: item.color }">{{ item.value }}</strong>
                  </div>
                  <div class="defects-page__severity-track">
                    <i :style="{ width: `${severityDistributionTotal ? item.value / severityDistributionTotal * 100 : 0}%`, backgroundColor: item.color }" />
                  </div>
                </div>
              </div>
              <div v-else class="defects-page__chart-empty">
                {{ statistics ? '暂无缺陷数据' : '暂无严重程度统计数据' }}
              </div>
            </div>
          </article>
        </div>
        <article class="defects-page__chart-card defects-page__chart-card--wide">
          <h3>新增 vs 关闭趋势</h3>
          <div class="defects-page__trend-chart">
            <DefectTrendAreaChart
              v-if="statistics"
              :items="trendDistributionItems"
            />
            <div v-else class="defects-page__chart-empty">暂无趋势统计数据</div>
          </div>
        </article>
        <article class="defects-page__chart-card defects-page__chart-card--wide defects-page__chart-card--assignees">
          <h3>负责人缺陷分布</h3>
          <div class="defects-page__assignee-chart">
            <DefectAssigneeBarChart
              v-if="assigneeDistributionItems.length"
              :items="assigneeDistributionItems"
            />
            <div v-else class="defects-page__chart-empty">暂无负责人缺陷数据</div>
          </div>
        </article>
      </section>
    </div>
  </AppPage>
</template>

<style scoped>
.defects-page {
  display: flex;
  min-width: 0;
  min-height: calc(100dvh - 86px);
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  background: #f4f6fa;
}

.defects-page__list-shell {
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.defects-page__tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: flex-start;
  padding-left: 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defects-page__tabs button {
  width: 80px;
  height: 43px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.defects-page__tabs button.is-active {
  border-bottom-color: #f53f3f;
  color: #f53f3f;
}

.defects-page__stats-view {
  min-height: 0;
  overflow: auto;
  padding: 21px;
  background: #f4f6fa;
}

.defects-page__stats-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.defects-page__stats-filter > span {
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defects-page__stats-filter-options {
  display: flex;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.defects-page__stats-filter-options button {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid #e5e6eb;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.defects-page__stats-filter-options button:last-child {
  border-right: 0;
}

.defects-page__stats-filter-options button.is-active {
  background: #165dff;
  color: #ffffff;
}

.defects-page__stats-date-range {
  width: 260px !important;
  min-width: 260px;
  flex: 0 0 260px;
}

.defects-page__stats-filter :deep(.el-date-editor.defects-page__stats-date-range) {
  width: 260px !important;
  min-width: 260px;
  flex: 0 0 260px;
  height: 32px;
}

.defects-page__stats-filter :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defects-page__stats-filter :deep(.el-input__inner) {
  color: rgba(29, 33, 41, 0.5);
  font-size: 13px;
  font-weight: 400;
}

.defects-page__stats-head h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.defects-page__stats-head p {
  margin: 0;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defects-page__stats-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 17.5px;
}

.defects-page__stats-cards article {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: 10.5px;
  min-height: 94.25px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.defects-page__stats-cards article i {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-style: normal;
  line-height: 1;
}

.defects-page__stats-cards article i img {
  width: 20px;
  height: 20px;
}

.defects-page__stats-cards article.is-total i {
  background: #f2f3f5;
  color: #4e5969;
}

.defects-page__stats-cards article.is-todo i {
  background: #fff3e8;
  color: #ff7d00;
}

.defects-page__stats-cards article.is-high i {
  background: #ffe8e8;
  color: #f53f3f;
}

.defects-page__stats-cards article.is-verify i {
  background: #fff7e8;
  color: #c89b00;
}

.defects-page__stats-cards article > div {
  min-width: 0;
}

.defects-page__stats-cards strong {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 24px;
}

.defects-page__stats-cards article.is-total strong {
  color: #1d2129;
}

.defects-page__stats-cards article.is-todo strong {
  color: #ff7d00;
}

.defects-page__stats-cards article.is-high strong {
  color: #f53f3f;
}

.defects-page__stats-cards article.is-verify strong {
  color: #c89b00;
}

.defects-page__stats-cards span {
  display: block;
  padding-top: 3.5px;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defects-page__stats-cards small {
  display: block;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.defects-page__stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17.5px;
  margin-top: 17.5px;
}

.defects-page__chart-card {
  box-sizing: border-box;
  height: 268.5px;
  padding: 18.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.defects-page__chart-card h3 {
  margin: 0;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.defects-page__chart-card--wide {
  height: 272px;
  margin-top: 17.5px;
}

.defects-page__chart-asset {
  position: relative;
  overflow: visible;
  margin-top: 10.5px;
}

.defects-page__chart-asset img {
  display: block;
  max-width: none;
}

.defects-page__chart-asset--status {
  width: 400px;
  height: 200px;
}

.defects-page__chart-asset--severity {
  width: min(865.25px, 100%);
  box-sizing: border-box;
  height: 170px;
  margin-top: 0;
  padding-top: 17.5px;
}

.defects-page__chart-asset--severity img {
  width: 865.25px;
  height: 170px;
}

.defects-page__severity-bars {
  display: grid;
  grid-auto-rows: 46px;
  row-gap: 0;
  align-content: start;
}

.defects-page__severity-row {
  display: grid;
  grid-template-rows: 18px 8px;
  align-content: start;
  row-gap: 4px;
}

.defects-page__severity-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defects-page__severity-meta strong {
  font-weight: 700;
}

.defects-page__severity-track {
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: #f2f3f5;
}

.defects-page__severity-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 180ms ease;
}

.defects-page__chart-empty {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 13px;
}

.defects-page__trend-chart {
  position: relative;
  width: 600px;
  height: 200px;
  margin-top: 14px;
  overflow: visible;
}

.defects-page__chart-card--assignees {
  height: auto;
  min-height: 251px;
}

.defects-page__assignee-chart {
  position: relative;
  min-height: 152px;
  margin-top: 14px;
}

.defects-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.defects-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defects-workspace-select__control {
  width: 192px;
}

.defects-workspace-select__error {
  max-width: 180px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .defects-workspace-select {
    width: 100%;
    flex-wrap: wrap;
  }

  .defects-workspace-select__control {
    width: min(240px, 100%);
  }
}
</style>
