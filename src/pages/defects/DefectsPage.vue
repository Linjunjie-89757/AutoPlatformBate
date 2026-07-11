<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { defectApi, type DefectClientFilter, type DefectStatistics } from '@/entities/defect'
import {
  useWorkspaceContext,
  workspaceApi,
  type WorkspaceItem,
  type WorkspaceMemberItem,
} from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { DefectFilterPanel } from '@/widgets/defect-filter-panel'
import { DefectListPanel } from '@/widgets/defect-list-panel'
import { DefectSummaryPanel } from '@/widgets/defect-summary-panel'

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceMembers = ref<WorkspaceMemberItem[]>([])
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
})
const listPanelRef = ref<InstanceType<typeof DefectListPanel> | null>(null)
const activeView = ref<'list' | 'stats'>('list')

const highPriorityCount = computed(() => {
  const source = statistics.value as (DefectStatistics & {
    highPriority?: number
    highPriorityCount?: number
  }) | null
  return source?.highPriority ?? source?.highPriorityCount ?? 0
})

const statsCards = computed(() => [
  {
    label: '缺陷总数',
    value: statistics.value?.total ?? 76,
    note: '本月新增 23 条',
    tone: 'total',
    icon: figmaDefectIcons.stats.icon.total,
  },
  {
    label: '待处理',
    value: statistics.value
      ? (statistics.value.todo ?? 0) + (statistics.value.assigned ?? 0)
      : 28,
    note: '新建 + 已指派',
    tone: 'todo',
    icon: figmaDefectIcons.stats.icon.todo,
  },
  {
    label: '高优先级',
    value: statistics.value ? highPriorityCount.value : 15,
    note: 'P0 + P1 缺陷',
    tone: 'high',
    icon: figmaDefectIcons.stats.icon.high,
  },
  {
    label: '待验证',
    value: statistics.value?.pendingVerify ?? 9,
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
  try {
    statistics.value = await defectApi.getDefectStatistics(workspaceCode.value)
  } catch {
    statistics.value = null
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
        businessWorkspaces.value.map((workspace) => workspaceApi.getWorkspaceMembers(workspace.workspaceCode)),
      )
      const memberMap = new Map<number, WorkspaceMemberItem>()
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

    workspaceMembers.value = await workspaceApi.getWorkspaceMembers(workspaceCode.value)
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
  listPanelRef.value?.openCreateDialog()
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
        <el-select
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
          :show-create-button="workspaceReady"
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
            embedded
            @reset="resetFilters"
            @create="handleCreateDefect"
          />

          <DefectListPanel
            v-if="workspaceReady"
            ref="listPanelRef"
            :workspace-code="workspaceCode"
            :filter="filter"
            :assignee-options="assigneeOptions"
            embedded
          />
        </section>
      </template>

      <section v-else class="defects-page__stats-view">
        <header class="defects-page__stats-head">
          <h2>缺陷统计</h2>
          <p>汇总当前项目的缺陷分布、严重程度和趋势，快速识别质量风险</p>
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
              <img :src="figmaDefectIcons.stats.chart.status" alt="" />
            </div>
          </article>
          <article class="defects-page__chart-card">
            <h3>严重程度分布</h3>
            <div class="defects-page__chart-asset defects-page__chart-asset--severity">
              <img :src="figmaDefectIcons.stats.chart.severity" alt="" />
            </div>
          </article>
        </div>
        <article class="defects-page__chart-card defects-page__chart-card--wide">
          <h3>模块缺陷分布</h3>
          <div class="defects-page__chart-asset defects-page__chart-asset--module">
            <img :src="figmaDefectIcons.stats.chart.module" alt="" />
          </div>
        </article>
        <article class="defects-page__chart-card defects-page__chart-card--wide">
          <h3>新增 vs 关闭趋势</h3>
          <div class="defects-page__trend-chart" aria-hidden="true">
            <span class="defects-page__trend-y is-y16">16</span>
            <span class="defects-page__trend-y is-y12">12</span>
            <span class="defects-page__trend-y is-y8">8</span>
            <span class="defects-page__trend-y is-y4">4</span>
            <span class="defects-page__trend-y is-y0">0</span>
            <span class="defects-page__trend-line is-line16" />
            <span class="defects-page__trend-line is-line12" />
            <span class="defects-page__trend-line is-line8" />
            <span class="defects-page__trend-line is-line4" />
            <span class="defects-page__trend-line is-line0" />
            <svg class="defects-page__trend-svg" viewBox="0 0 550 142" preserveAspectRatio="none">
              <path d="M0 116 C55 84 92 100 137.5 62 C192.5 14 253 92 320 53 C392 12 452 58 550 34" fill="rgba(245,63,63,0.08)" />
              <path d="M0 116 C55 84 92 100 137.5 62 C192.5 14 253 92 320 53 C392 12 452 58 550 34" fill="none" stroke="#f53f3f" stroke-width="2" />
              <path d="M0 128 C66 124 106 108 159 116 C229 127 260 73 330 88 C410 104 460 66 550 78" fill="rgba(0,180,42,0.08)" />
              <path d="M0 128 C66 124 106 108 159 116 C229 127 260 73 330 88 C410 104 460 66 550 78" fill="none" stroke="#00b42a" stroke-width="2" />
            </svg>
            <div class="defects-page__trend-axis">
              <span>6/5</span>
              <span>6/10</span>
              <span>6/15</span>
              <span>6/20</span>
              <span>6/25</span>
              <span>6/30</span>
              <span>7/5</span>
            </div>
            <div class="defects-page__trend-legend">
              <span class="is-new">新增</span>
              <span class="is-closed">关闭</span>
            </div>
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
  overflow: hidden;
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

.defects-page__chart-asset--status img {
  width: 400px;
  height: 200px;
}

.defects-page__chart-asset--severity {
  width: min(865.25px, 100%);
  height: 170px;
  margin-top: 0;
}

.defects-page__chart-asset--severity img {
  width: 865.25px;
  height: 170px;
}

.defects-page__chart-asset--module {
  width: 600px;
  height: 200px;
  margin-top: 14px;
}

.defects-page__chart-asset--module img {
  width: 600px;
  height: 200px;
}

.defects-page__trend-chart {
  position: relative;
  width: 600px;
  height: 214px;
  margin-top: 14px;
  overflow: hidden;
}

.defects-page__trend-y {
  position: absolute;
  width: 14px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  text-align: right;
}

.defects-page__trend-y.is-y16 {
  top: 1.26px;
  left: 18px;
}

.defects-page__trend-y.is-y12 {
  top: 31.01px;
  left: 18px;
}

.defects-page__trend-y.is-y8 {
  top: 64.76px;
  left: 24px;
}

.defects-page__trend-y.is-y4 {
  top: 98.51px;
  left: 24px;
}

.defects-page__trend-y.is-y0 {
  top: 132.26px;
  left: 24px;
}

.defects-page__trend-line {
  position: absolute;
  left: 40px;
  width: 550px;
  height: 1px;
  background: #e5e6eb;
}

.defects-page__trend-line.is-line16 {
  top: 5px;
}

.defects-page__trend-line.is-line12 {
  top: 38.75px;
}

.defects-page__trend-line.is-line8 {
  top: 72.5px;
}

.defects-page__trend-line.is-line4 {
  top: 106.25px;
}

.defects-page__trend-line.is-line0 {
  top: 140px;
}

.defects-page__trend-svg {
  position: absolute;
  top: 0;
  left: 40px;
  width: 550px;
  height: 142px;
  overflow: visible;
}

.defects-page__trend-axis {
  position: absolute;
  left: 30px;
  top: 144.52px;
  display: flex;
  width: 569.5px;
  justify-content: space-between;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
}

.defects-page__trend-legend {
  position: absolute;
  top: 182px;
  left: 260px;
  display: flex;
  gap: 10px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.defects-page__trend-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.defects-page__trend-legend span::before {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  content: '';
}

.defects-page__trend-legend .is-new {
  color: #f53f3f;
}

.defects-page__trend-legend .is-new::before {
  background: #f53f3f;
}

.defects-page__trend-legend .is-closed {
  color: #00b42a;
}

.defects-page__trend-legend .is-closed::before {
  background: #00b42a;
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
