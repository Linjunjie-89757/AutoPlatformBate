<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { aiProviderApi } from '@/entities/ai-provider'
import { configApi, type ConfigCenterTab } from '@/entities/config'
import { localRunnerApi } from '@/entities/local-runner'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { ConfigAiPanel } from '@/widgets/config-ai-panel'
import ConfigDbPanel from '@/widgets/config-db-panel/ConfigDbPanel.vue'
import ConfigEnvironmentFigmaWorkspace from '@/widgets/config-env-panel/ConfigEnvironmentFigmaWorkspace.vue'
import ConfigMockPanel from '@/widgets/config-mock-panel/ConfigMockPanel.vue'
import ConfigNotificationPanel from '@/widgets/config-notification-panel/ConfigNotificationPanel.vue'
import ConfigVariableFigmaWorkspace from '@/widgets/config-param-panel/ConfigVariableFigmaWorkspace.vue'
import ConfigRunnerPanel from '@/widgets/config-runner-panel/ConfigRunnerPanel.vue'
import { figmaConfigOverviewIcons } from '@/shared/assets/figma-icons'

type ConfigCenterView = ConfigCenterTab | 'overview' | 'ai'

interface ConfigTabItem {
  key: ConfigCenterView
  label: string
}

interface OverviewCard {
  label: string
  value: string
  detail: string
  icon: string
  color: string
  bg: string
}

interface CountMetric {
  total: number
  enabled: number
}

interface RunnerMetric {
  total: number
  online: number
}

interface AiMetric extends CountMetric {
  keyConfigured: number
}

interface OverviewMetrics {
  database: CountMetric | null
  environment: CountMetric | null
  runner: RunnerMetric | null
  ai: AiMetric | null
  notification: CountMetric | null
  parameter: CountMetric | null
}

const configTabs: ConfigTabItem[] = [
  { key: 'overview', label: '配置总览' },
  { key: 'dbConnection', label: '数据库配置' },
  { key: 'env', label: '环境配置' },
  { key: 'param', label: '变量配置' },
  { key: 'notification', label: '通知配置' },
  { key: 'runner', label: 'Runner 配置' },
  { key: 'ai', label: 'AI 连接配置' },
  { key: 'mock', label: 'Mock 服务' },
]

const configTabKeys = new Set<ConfigCenterView>(configTabs.map(item => item.key))

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaces = ref<WorkspaceItem[]>([])
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')
const overviewLoading = ref(false)
const overviewErrorMessage = ref('')
const overviewMetrics = ref<OverviewMetrics>({
  database: null,
  environment: null,
  runner: null,
  ai: null,
  notification: null,
  parameter: null,
})
const activeTab = ref<ConfigCenterView>(resolveConfigTab(route.query.tab))
const workspaceCode = computed({
  get: () => selectedWorkspaceCode.value,
  set: (value: string) => setSelectedWorkspaceCode(value),
})
const pageErrorMessage = computed(() => (
  workspaceErrorMessage.value
  || (activeTab.value === 'overview' ? overviewErrorMessage.value : '')
))
const overviewCards = computed<OverviewCard[]>(() => {
  const metrics = overviewMetrics.value
  return [
    {
      label: '数据库连接',
      value: metricValue(metrics.database),
      detail: countMetricDetail(metrics.database),
      icon: figmaConfigOverviewIcons.database,
      color: '#165DFF',
      bg: '#E8F3FF',
    },
    {
      label: '测试环境',
      value: metricValue(metrics.environment),
      detail: countMetricDetail(metrics.environment),
      icon: figmaConfigOverviewIcons.environment,
      color: '#00B42A',
      bg: '#E8FFEA',
    },
    {
      label: 'Runner 节点',
      value: metrics.runner ? `${metrics.runner.online}/${metrics.runner.total}` : '—',
      detail: metrics.runner ? `${metrics.runner.online} 个在线运行` : metricUnavailableText(),
      icon: figmaConfigOverviewIcons.runner,
      color: '#0FC6C2',
      bg: '#E8FFFB',
    },
    {
      label: 'AI 连接',
      value: metrics.ai ? `${metrics.ai.enabled}/${metrics.ai.total}` : '—',
      detail: metrics.ai ? `${metrics.ai.keyConfigured} 个 Key 已配置` : metricUnavailableText(),
      icon: figmaConfigOverviewIcons.ai,
      color: '#4E5AC8',
      bg: '#EEF0FA',
    },
    {
      label: '通知渠道',
      value: metricValue(metrics.notification),
      detail: metrics.notification ? `${metrics.notification.enabled} 个已启用` : metricUnavailableText(),
      icon: figmaConfigOverviewIcons.notification,
      color: '#7816FF',
      bg: '#F5E8FF',
    },
    {
      label: '变量配置',
      value: metricValue(metrics.parameter),
      detail: metrics.parameter ? `${metrics.parameter.enabled} 个已启用` : metricUnavailableText(),
      icon: figmaConfigOverviewIcons.parameter,
      color: '#FF7D00',
      bg: '#FFF3E8',
    },
  ]
})
const trendTicks = computed(() => {
  const xPositions = [27.5, 119.16, 210.83, 302.5, 394.16, 485.83, 573.32]
  return xPositions.map((x, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return { label: `${date.getMonth() + 1}/${date.getDate()}`, x }
  })
})
let overviewRequestId = 0

function metricUnavailableText() {
  return overviewLoading.value ? '统计加载中' : '数据获取失败'
}

function metricValue(metric: CountMetric | null) {
  return metric ? String(metric.total) : '—'
}

function countMetricDetail(metric: CountMetric | null) {
  return metric ? `${metric.enabled} 启用 · ${metric.total - metric.enabled} 停用` : metricUnavailableText()
}

async function loadCountMetric(
  loadAll: () => Promise<{ total: number }>,
  loadEnabled: () => Promise<{ total: number }>,
): Promise<CountMetric> {
  const [all, enabled] = await Promise.all([loadAll(), loadEnabled()])
  return { total: all.total, enabled: enabled.total }
}

function settledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled' ? result.value : null
}

async function loadOverview() {
  const requestId = ++overviewRequestId
  const requestedWorkspaceCode = workspaceCode.value || 'ALL'
  overviewLoading.value = true
  overviewErrorMessage.value = ''

  const results = await Promise.allSettled([
    loadCountMetric(
      () => configApi.getSettingsDbConnections(requestedWorkspaceCode),
      () => configApi.getSettingsDbConnections(requestedWorkspaceCode, { status: 1 }),
    ),
    loadCountMetric(
      () => configApi.getSettingsEnvs(requestedWorkspaceCode),
      () => configApi.getSettingsEnvs(requestedWorkspaceCode, { status: 1 }),
    ),
    localRunnerApi.getRunnerNodes().then(items => ({
      total: items.length,
      online: items.filter(item => !item.offline).length,
    })),
    aiProviderApi.getProviderConnections(requestedWorkspaceCode).then(items => ({
      total: items.length,
      enabled: items.filter(item => item.status === 1).length,
      keyConfigured: items.filter(item => item.apiKeyConfigured).length,
    })),
    loadCountMetric(
      () => configApi.getNotificationChannels(requestedWorkspaceCode),
      () => configApi.getNotificationChannels(requestedWorkspaceCode, { status: 1 }),
    ),
    loadCountMetric(
      () => configApi.getSettingsParams(requestedWorkspaceCode),
      () => configApi.getSettingsParams(requestedWorkspaceCode, { status: 1 }),
    ),
  ] as const)

  if (requestId !== overviewRequestId) return

  overviewMetrics.value = {
    database: settledValue(results[0]),
    environment: settledValue(results[1]),
    runner: settledValue(results[2]),
    ai: settledValue(results[3]),
    notification: settledValue(results[4]),
    parameter: settledValue(results[5]),
  }
  const labels = ['数据库连接', '测试环境', 'Runner 节点', 'AI 连接', '通知渠道', '变量配置']
  const failedLabels = results
    .map((result, index) => result.status === 'rejected' ? labels[index] : '')
    .filter(Boolean)
  overviewErrorMessage.value = failedLabels.length
    ? `部分配置统计加载失败：${failedLabels.join('、')}`
    : ''
  overviewLoading.value = false
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some((item) => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }
  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    setSelectedWorkspaceCode(resolveDefaultWorkspaceCode(items))
  } catch (error) {
    setSelectedWorkspaceCode(selectedWorkspaceCode.value || 'ALL')
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceReady.value = true
  }
}

function resolveConfigTab(tab: unknown): ConfigCenterView {
  const value = Array.isArray(tab) ? tab[0] : tab
  return typeof value === 'string' && configTabKeys.has(value as ConfigCenterView)
    ? value as ConfigCenterView
    : 'overview'
}

function selectConfigTab(tab: ConfigCenterView) {
  activeTab.value = tab
  void router.replace({
    query: {
      ...route.query,
      tab: tab === 'overview' ? undefined : tab,
    },
  })
}

onMounted(() => {
  void loadWorkspaces()
})

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = resolveConfigTab(tab)
  },
)

watch(
  [activeTab, workspaceCode, workspaceReady],
  ([tab, , ready]) => {
    if (tab === 'overview' && ready) {
      void loadOverview()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="config-center-page">
    <div class="config-center-page__tabs" role="tablist" aria-label="配置中心">
      <button
        v-for="item in configTabs"
        :key="item.key"
        class="config-center-page__tab"
        :class="{ 'is-active': activeTab === item.key }"
        type="button"
        role="tab"
        :aria-selected="activeTab === item.key"
        @click="selectConfigTab(item.key)"
      >
        {{ item.label }}
      </button>
    </div>

    <main class="config-center-page__content app-soft-scrollbar">
      <div
        v-if="pageErrorMessage"
        class="config-center-page__workspace-error"
      >
        {{ pageErrorMessage }}
      </div>

      <section v-if="activeTab === 'overview'" class="config-overview">
        <header class="config-overview__head">
          <h2>配置中心</h2>
          <p>管理数据库连接、测试环境、执行节点、AI 服务等平台基础配置</p>
        </header>

        <div class="config-overview__cards">
          <article
            v-for="card in overviewCards"
            :key="card.label"
            class="config-overview-card"
          >
            <span
              class="config-overview-card__icon"
              :style="{ color: card.color, backgroundColor: card.bg }"
            >
              <img :src="card.icon" alt="">
            </span>
            <div class="config-overview-card__copy">
              <p class="config-overview-card__label">{{ card.label }}</p>
              <strong
                class="config-overview-card__value"
                :style="{ color: card.color }"
              >
                {{ card.value }}
              </strong>
              <p class="config-overview-card__detail">{{ card.detail }}</p>
            </div>
          </article>
        </div>

        <section class="config-overview-trend">
          <h3>连接测试趋势</h3>
          <div class="config-overview-trend__chart" aria-label="连接测试趋势：后台暂未提供测试历史数据">
            <svg viewBox="0 0 600 200" role="img">
              <g class="config-overview-trend__grid">
                <line x1="40" x2="590" y1="140" y2="140" />
                <line x1="40" x2="590" y1="106.25" y2="106.25" />
                <line x1="40" x2="590" y1="72.5" y2="72.5" />
                <line x1="40" x2="590" y1="38.75" y2="38.75" />
                <line x1="40" x2="590" y1="5" y2="5" />
              </g>
              <g class="config-overview-trend__axis">
                <text x="24" y="145">0</text>
                <text x="25" y="111">7</text>
                <text x="18" y="78">14</text>
                <text x="19" y="44">21</text>
                <text x="17" y="10">28</text>
                <text
                  v-for="tick in trendTicks"
                  :key="tick.label"
                  :x="tick.x"
                  y="160"
                >
                  {{ tick.label }}
                </text>
              </g>
              <g class="config-overview-trend__empty">
                <text x="315" y="80">暂无真实趋势数据</text>
                <text x="315" y="101">后台暂未提供连接测试历史接口</text>
              </g>
              <g class="config-overview-trend__legend">
                <circle cx="260" cy="192" r="3.5" class="is-success" />
                <text x="271" y="196">成功</text>
                <circle cx="305" cy="192" r="3.5" class="is-failure" />
                <text x="316" y="196">失败</text>
              </g>
            </svg>
          </div>
        </section>
      </section>

      <section v-else class="config-center-page__panel">
        <ConfigDbPanel v-if="activeTab === 'dbConnection'" :workspace-code="workspaceCode" />
        <ConfigEnvironmentFigmaWorkspace v-else-if="activeTab === 'env'" :workspace-code="workspaceCode" />
        <ConfigVariableFigmaWorkspace v-else-if="activeTab === 'param'" :workspace-code="workspaceCode" />
        <ConfigMockPanel v-else-if="activeTab === 'mock'" :workspace-code="workspaceCode" />
        <ConfigNotificationPanel v-else-if="activeTab === 'notification'" :workspace-code="workspaceCode" />
        <ConfigRunnerPanel v-else-if="activeTab === 'runner'" />
        <ConfigAiPanel v-else-if="activeTab === 'ai'" :workspace-code="workspaceCode" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.config-center-page {
  display: flex;
  height: calc(100dvh - 42px);
  min-height: 0;
  flex-direction: column;
  background: var(--app-bg-page);
}

.config-center-page__tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border);
  background: #ffffff;
}

.config-center-page__tab {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition: border-color 150ms ease, color 150ms ease;
}

.config-center-page__tab:hover {
  color: var(--app-indigo);
}

.config-center-page__tab.is-active {
  border-bottom-color: var(--app-indigo);
  color: var(--app-indigo);
}

.config-center-page__content {
  overflow: auto;
  min-width: 0;
  flex: 1;
  min-height: 0;
  padding: 21px;
}

.config-center-page__panel {
  min-width: 0;
}

.config-center-page__workspace-error {
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

.config-overview__head {
  margin-bottom: 21px;
}

.config-overview__head h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 27px;
}

.config-overview__head p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 23.5px;
}

.config-overview__cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 21px;
}

.config-overview-card {
  display: flex;
  min-height: 115.5px;
  align-items: flex-start;
  gap: 14px;
  padding: 18.5px;
  border: 1px solid var(--app-border);
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.config-overview-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 7px;
}

.config-overview-card__icon img {
  display: block;
  width: 22px;
  height: 22px;
}

.config-overview-card__copy {
  min-width: 0;
}

.config-overview-card__label,
.config-overview-card__detail {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.config-overview-card__value {
  display: block;
  margin-top: 3.5px;
  font-size: 26px;
  font-weight: 700;
  line-height: 39px;
}

.config-overview-trend {
  min-height: 274px;
  padding: 18.5px;
  border: 1px solid var(--app-border);
  border-radius: 11px;
  background: #ffffff;
}

.config-overview-trend h3 {
  margin: 0 0 4px;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.config-overview-trend__chart {
  overflow-x: auto;
  width: 100%;
}

.config-overview-trend__chart svg {
  display: block;
  width: 600px;
  height: 214px;
}

.config-overview-trend__grid line {
  stroke: #f2f3f5;
  stroke-dasharray: 3 3;
  stroke-width: 1;
}

.config-overview-trend__axis text,
.config-overview-trend__legend text {
  fill: var(--app-text-muted);
  font-size: 12px;
  font-weight: 400;
}

.config-overview-trend__empty text {
  fill: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-anchor: middle;
}

.config-overview-trend__empty text:last-child {
  fill: var(--app-text-muted);
  font-size: 11px;
  font-weight: 400;
}

.config-overview-trend__success-area {
  fill: url(#configTrendSuccess);
}

.config-overview-trend__success-line,
.config-overview-trend__failure-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.config-overview-trend__success-line {
  stroke: var(--app-primary);
  stroke-width: 2.5;
}

.config-overview-trend__failure-line {
  stroke: var(--app-danger);
  stroke-width: 2;
}

.config-overview-trend__legend .is-success {
  fill: var(--app-primary);
}

.config-overview-trend__legend .is-failure {
  fill: var(--app-danger);
}

@media (max-width: 900px) {
  .config-overview__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .config-center-page__tabs {
    overflow-x: auto;
  }

  .config-overview__cards {
    grid-template-columns: 1fr;
  }

  .config-center-page__content {
    padding: 16px;
  }
}
</style>
