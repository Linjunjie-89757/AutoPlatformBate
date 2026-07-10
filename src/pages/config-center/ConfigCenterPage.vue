<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ConfigCenterTab } from '@/entities/config'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { ConfigAiPanel } from '@/widgets/config-ai-panel'
import ConfigDbPanel from '@/widgets/config-db-panel/ConfigDbPanel.vue'
import ConfigEnvPanel from '@/widgets/config-env-panel/ConfigEnvPanel.vue'
import ConfigNotificationPanel from '@/widgets/config-notification-panel/ConfigNotificationPanel.vue'
import ConfigParamPanel from '@/widgets/config-param-panel/ConfigParamPanel.vue'
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

const configTabs: ConfigTabItem[] = [
  { key: 'overview', label: '配置总览' },
  { key: 'dbConnection', label: '数据库配置' },
  { key: 'env', label: '环境配置' },
  { key: 'param', label: '参数配置' },
  { key: 'notification', label: '通知配置' },
  { key: 'runner', label: 'Runner 配置' },
  { key: 'ai', label: 'AI 连接配置' },
]

const configTabKeys = new Set<ConfigCenterView>(configTabs.map(item => item.key))

const overviewCards: OverviewCard[] = [
  { label: '数据库连接', value: '5', detail: '4 启用 · 1 停用', icon: figmaConfigOverviewIcons.database, color: '#165DFF', bg: '#E8F3FF' },
  { label: '测试环境', value: '4', detail: '3 启用 · 1 停用', icon: figmaConfigOverviewIcons.environment, color: '#00B42A', bg: '#E8FFEA' },
  { label: 'Runner 节点', value: '3/4', detail: '3 个在线运行', icon: figmaConfigOverviewIcons.runner, color: '#0FC6C2', bg: '#E8FFFB' },
  { label: 'AI 连接', value: '2/4', detail: '2 个 Key 已配置', icon: figmaConfigOverviewIcons.ai, color: '#4E5AC8', bg: '#EEF0FA' },
  { label: '通知渠道', value: '4', detail: '3 个已启用', icon: figmaConfigOverviewIcons.notification, color: '#7816FF', bg: '#F5E8FF' },
  { label: '全局参数', value: '4', detail: '3 个已启用', icon: figmaConfigOverviewIcons.parameter, color: '#FF7D00', bg: '#FFF3E8' },
]

const trendTicks = [
  { label: '5/14', x: 27.5 },
  { label: '5/15', x: 119.16 },
  { label: '5/16', x: 210.83 },
  { label: '5/17', x: 302.5 },
  { label: '5/18', x: 394.16 },
  { label: '5/19', x: 485.83 },
  { label: '5/20', x: 573.32 },
]
const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaces = ref<WorkspaceItem[]>([])
const workspaceErrorMessage = ref('')
const activeTab = ref<ConfigCenterView>(resolveConfigTab(route.query.tab))
const workspaceCode = computed({
  get: () => selectedWorkspaceCode.value,
  set: (value: string) => setSelectedWorkspaceCode(value),
})

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
        v-if="workspaceErrorMessage"
        class="config-center-page__workspace-error"
      >
        {{ workspaceErrorMessage }}
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
          <div class="config-overview-trend__chart" aria-label="连接测试趋势：成功和失败次数">
            <svg viewBox="0 0 600 200" role="img">
              <defs>
                <linearGradient id="configTrendSuccess" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stop-color="#165DFF" stop-opacity="0.12" />
                  <stop offset="95%" stop-color="#165DFF" stop-opacity="0" />
                </linearGradient>
              </defs>
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
              <path
                class="config-overview-trend__success-area"
                d="M40 82 C78 66 101 56 132 56 C168 56 188 74 223 68 C258 62 282 29 315 27 C350 25 382 51 407 48 C445 45 468 15 500 14 C540 13 565 29 590 38 L590 140 L40 140 Z"
              />
              <path
                class="config-overview-trend__success-line"
                d="M40 82 C78 66 101 56 132 56 C168 56 188 74 223 68 C258 62 282 29 315 27 C350 25 382 51 407 48 C445 45 468 15 500 14 C540 13 565 29 590 38"
              />
              <path
                class="config-overview-trend__failure-line"
                d="M40 130 C76 134 104 136 132 135 C164 134 188 126 223 125 C258 124 283 140 315 140 C350 140 375 121 407 121 C446 121 470 136 500 135 C540 134 565 133 590 130"
              />
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
        <ConfigEnvPanel v-else-if="activeTab === 'env'" :workspace-code="workspaceCode" />
        <ConfigParamPanel v-else-if="activeTab === 'param'" :workspace-code="workspaceCode" />
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
  font-weight: 500;
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
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--app-shadow-card);
}

.config-overview-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
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
  border-radius: 12px;
  background: #ffffff;
}

.config-overview-trend h3 {
  margin: 0 0 4px;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 23px;
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
