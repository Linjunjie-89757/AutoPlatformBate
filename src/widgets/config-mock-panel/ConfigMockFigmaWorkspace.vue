<script setup lang="ts">
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  Edit2,
  Eye,
  Globe2,
  Layers,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from '@lucide/vue'

import type {
  ConfigReferenceSummary,
  MockApplicationItem,
  MockCallLogItem,
  MockEndpointItem,
  MockReleaseItem,
  MockScenarioItem,
} from '@/entities/config'

import { useConfigMockWorkspaceView } from './useConfigMockWorkspaceView'

const props = defineProps<{
  applications: MockApplicationItem[]
  endpoints: MockEndpointItem[]
  scenarios: MockScenarioItem[]
  releases: MockReleaseItem[]
  logs: MockCallLogItem[]
  activeAppId: number | null
  loading?: boolean
  errorMessage?: string
  releaseLoading?: boolean
  referenceLoading?: boolean
  referenceSummary: ConfigReferenceSummary | null
}>()

const emit = defineEmits<{
  (event: 'select-app', id: number): void
  (event: 'refresh'): void
  (event: 'create-app'): void
  (event: 'edit-app', app: MockApplicationItem): void
  (event: 'toggle-app', app: MockApplicationItem): void
  (event: 'publish'): void
  (event: 'activate-release', release: MockReleaseItem): void
  (event: 'create-endpoint'): void
  (event: 'edit-endpoint', endpoint: MockEndpointItem): void
  (event: 'copy-endpoint', endpoint: MockEndpointItem): void
  (event: 'delete-endpoint', endpoint: MockEndpointItem): void
  (event: 'create-scenario', endpoint: MockEndpointItem): void
  (event: 'edit-scenario', scenario: MockScenarioItem): void
  (event: 'copy-scenario', scenario: MockScenarioItem): void
  (event: 'delete-scenario', scenario: MockScenarioItem): void
  (event: 'open-log', log: MockCallLogItem): void
  (event: 'load-references'): void
}>()

const {
  activeTab,
  appSearch,
  endpointSearch,
  endpointMethod,
  endpointStatus,
  endpointVersion,
  logSearch,
  logMethod,
  logResult,
  expandedEndpointId,
  activeApp,
  activeEndpoints,
  activeScenarios,
  activeRelease,
  activeReferenceItems,
  unmatchedCount,
  filteredApplications,
  filteredEndpoints,
  filteredLogs,
  changeTab,
  selectApplication,
  scenariosFor,
  endpointCount,
  appLogCount,
  appUnmatchedCount,
  appState,
  methodClass,
  formatDate,
  formatRelativeTime,
  releaseTitle,
  logResultTone,
  statusCodeTone,
  copyBaseUrl,
  goToEnvironmentConfig,
} = useConfigMockWorkspaceView({
  props,
  emitLoadReferences: () => emit('load-references'),
  emitSelectApp: id => emit('select-app', id),
})
</script>

<template>
  <section class="figma-mock-workspace">
    <aside class="figma-mock-apps">
      <div class="figma-mock-apps__head">
        <strong>Mock 应用</strong>
        <button type="button" class="figma-mock-btn is-primary" @click="emit('create-app')">
          <Plus :size="12" />新建
        </button>
      </div>
      <label class="figma-mock-search">
        <Search :size="14" />
        <input v-model="appSearch" type="search" placeholder="搜索应用名称或编码">
      </label>
      <div v-if="loading && !applications.length" class="figma-mock-apps__empty"><RefreshCw class="is-spin" :size="28" /><span>正在加载 Mock 应用...</span></div>
      <div v-else-if="filteredApplications.length" class="figma-mock-apps__list app-soft-scrollbar">
        <button
          v-for="app in filteredApplications"
          :key="app.id"
          type="button"
          class="figma-mock-app-card"
          :class="{ 'is-active': app.id === activeAppId }"
          @click="selectApplication(app.id)"
        >
          <span class="figma-mock-app-card__title">
            <strong>{{ app.appName }}</strong>
            <span class="figma-mock-state" :class="`is-${appState(app).tone}`">
              <i />{{ appState(app).label }}
            </span>
          </span>
          <code>{{ app.appCode }}</code>
          <span class="figma-mock-app-card__meta">
            <template v-if="app.id === activeAppId && activeRelease">v{{ activeRelease.versionNo }}</template>
            <template v-else-if="app.id === activeAppId">无版本</template>
            <template v-else>版本未加载</template>
            <i />{{ endpointCount(app.id) }} 接口
            <i />
            <b v-if="appUnmatchedCount(app.id)" class="is-danger">{{ appUnmatchedCount(app.id) }} 未匹配</b>
            <template v-else>{{ appLogCount(app.id) }} 次调用</template>
          </span>
        </button>
      </div>
      <div v-else class="figma-mock-apps__empty">
        <Layers :size="30" />
        <strong>暂无 Mock 应用</strong>
        <span>创建应用后即可配置接口和场景</span>
      </div>
    </aside>

    <main v-if="activeApp" class="figma-mock-main">
      <header class="figma-mock-summary">
        <div class="figma-mock-summary__identity">
          <span class="figma-mock-summary__icon"><Layers :size="23" /></span>
          <div>
            <div class="figma-mock-summary__title">
              <h2>{{ activeApp.appName }}</h2>
              <span class="figma-mock-state" :class="`is-${appState(activeApp).tone}`"><i />{{ appState(activeApp).label }}</span>
              <span v-if="activeRelease" class="figma-mock-version">v{{ activeRelease.versionNo }}</span>
            </div>
            <div class="figma-mock-summary__meta">
              <span>编码：<code>{{ activeApp.appCode }}</code></span><i />
              <span>Mock 地址：<button type="button" @click="copyBaseUrl">/api/mock/{{ activeApp.appCode }}</button></span><i />
              <span>延迟：<b>{{ activeScenarios[0]?.responseDelayMs ?? 0 }} ms</b></span><i />
              <span>访问凭据：<b class="is-muted">未配置</b></span>
            </div>
          </div>
        </div>
        <div class="figma-mock-summary__actions">
          <span class="figma-mock-stat"><strong>{{ activeEndpoints.length }}</strong><small>接口</small></span>
          <span class="figma-mock-stat"><strong>{{ activeScenarios.length }}</strong><small>场景</small></span>
          <span class="figma-mock-stat" :class="{ 'is-warning': unmatchedCount }"><strong>{{ unmatchedCount }}</strong><small>未匹配</small></span>
          <span class="figma-mock-summary__separator" aria-hidden="true" />
          <button type="button" class="figma-mock-btn" @click="emit('edit-app', activeApp)"><Edit2 :size="14" />编辑</button>
          <button type="button" class="figma-mock-btn" @click="emit('toggle-app', activeApp)"><Power :size="14" />{{ activeApp.status === 1 ? '停用' : '启用' }}</button>
          <button type="button" class="figma-mock-btn is-primary" :class="{ 'is-warning': !activeRelease }" @click="emit('publish')">
            <ArrowUpRight :size="14" />{{ activeRelease ? '发布新版本' : '首次发布' }}
          </button>
        </div>
      </header>

      <nav class="figma-mock-tabs">
        <button type="button" :class="{ 'is-active': activeTab === 'interfaces' }" @click="changeTab('interfaces')">接口与场景 ({{ activeEndpoints.length }})</button>
        <button type="button" :class="{ 'is-active': activeTab === 'releases' }" @click="changeTab('releases')">发布版本 ({{ releases.length }})</button>
        <button type="button" :class="{ 'is-active': activeTab === 'references' }" @click="changeTab('references')">环境引用 ({{ activeReferenceItems.length }})</button>
        <button type="button" :class="{ 'is-active': activeTab === 'logs' }" @click="changeTab('logs')">调用日志</button>
      </nav>

      <div class="figma-mock-content app-soft-scrollbar">
        <section v-if="activeTab === 'interfaces'" class="figma-mock-pane is-interface-pane" :class="{ 'is-empty-state': !filteredEndpoints.length }">
          <div class="figma-mock-toolbar">
            <label class="figma-mock-search is-wide"><Search :size="14" /><input v-model="endpointSearch" type="search" placeholder="搜索接口名称或路径"></label>
            <select v-model="endpointMethod"><option value="ALL">全部方法</option><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
            <select v-model="endpointStatus"><option value="ALL">全部状态</option><option value="ENABLED">已启用</option><option value="DISABLED">已停用</option></select>
            <select v-model="endpointVersion"><option value="ALL">全部版本</option><option value="PUBLISHED">已发布</option><option value="DRAFT">草稿</option></select>
            <span class="figma-mock-toolbar__spacer" />
            <button type="button" class="figma-mock-btn" disabled title="后端暂未提供 Mock 批量导入接口"><Upload :size="14" />导入</button>
            <button type="button" class="figma-mock-btn is-primary" @click="emit('create-endpoint')"><Plus :size="14" />新增接口</button>
          </div>

          <div v-if="filteredEndpoints.length" class="figma-mock-endpoints">
            <article
              v-for="endpoint in filteredEndpoints"
              :key="endpoint.id"
              class="figma-mock-endpoint"
              :class="{ 'is-expanded': expandedEndpointId === endpoint.id }"
            >
              <div class="figma-mock-endpoint__head">
                <button type="button" class="figma-mock-icon-btn" @click="expandedEndpointId = expandedEndpointId === endpoint.id ? null : endpoint.id">
                  <ChevronDown v-if="expandedEndpointId === endpoint.id" :size="14" /><ChevronRight v-else :size="14" />
                </button>
                <span class="figma-mock-method" :class="methodClass(endpoint.httpMethod)">{{ endpoint.httpMethod }}</span>
                <code>{{ endpoint.pathPattern }}</code>
                <span class="figma-mock-endpoint__name">{{ endpoint.endpointName }}</span>
                <span class="figma-mock-publish-state" :class="activeRelease ? 'is-published' : 'is-draft'">{{ activeRelease ? '已发布' : '草稿' }}</span>
                <span class="figma-mock-endpoint__count">{{ scenariosFor(endpoint.id).length }} 场景</span>
                <span class="figma-mock-endpoint__status" :class="{ 'is-disabled': endpoint.status === 0 }">{{ endpoint.status === 1 ? '启用' : '停用' }}</span>
                <span class="figma-mock-row-actions">
                  <button type="button" title="添加场景" @click="emit('create-scenario', endpoint)"><Plus :size="14" /></button>
                  <button type="button" title="编辑接口" @click="emit('edit-endpoint', endpoint)"><Edit2 :size="14" /></button>
                  <button type="button" title="复制接口" @click="emit('copy-endpoint', endpoint)"><Copy :size="14" /></button>
                  <button type="button" title="删除接口" @click="emit('delete-endpoint', endpoint)"><Trash2 :size="14" /></button>
                </span>
              </div>
              <div v-if="expandedEndpointId === endpoint.id" class="figma-mock-scenarios">
                <div class="figma-mock-scenario-grid is-head"><span>场景名称</span><span>优先级</span><span>状态码</span><span>延迟</span><span>默认</span><span>版本</span><span>更新时间</span><span>操作</span></div>
                <template v-if="scenariosFor(endpoint.id).length">
                  <div v-for="scenario in scenariosFor(endpoint.id)" :key="scenario.id" class="figma-mock-scenario-grid">
                    <button type="button" class="figma-mock-scenario-name" @click="emit('edit-scenario', scenario)">{{ scenario.scenarioName }}</button>
                    <span class="is-mono">{{ scenario.priority }}</span>
                    <span class="is-mono" :class="`is-${statusCodeTone(scenario.responseStatus)}`">{{ scenario.responseStatus }}</span>
                    <span class="is-mono is-muted">{{ scenario.responseDelayMs }} ms</span>
                    <span class="is-muted">—</span>
                    <span class="figma-mock-publish-state" :class="activeRelease ? 'is-published' : 'is-draft'">{{ activeRelease ? '已发布' : '草稿' }}</span>
                    <span class="is-mono is-muted">—</span>
                    <span class="figma-mock-row-actions is-right">
                      <button type="button" title="调试" @click="emit('edit-scenario', scenario)"><Play :size="14" /></button>
                      <button type="button" title="编辑场景" @click="emit('edit-scenario', scenario)"><Edit2 :size="14" /></button>
                      <button type="button" title="复制场景" @click="emit('copy-scenario', scenario)"><Copy :size="14" /></button>
                      <button type="button" title="删除场景" @click="emit('delete-scenario', scenario)"><Trash2 :size="14" /></button>
                    </span>
                  </div>
                </template>
                <div v-else class="figma-mock-inline-empty">暂无场景，点击上方“添加场景”开始创建</div>
              </div>
            </article>
          </div>
          <div v-else class="figma-mock-empty is-design-empty"><Layers :size="40" /><strong>暂无 Mock 接口</strong><span>新增接口后即可配置请求匹配与响应场景</span></div>
        </section>

        <section v-else-if="activeTab === 'releases'" class="figma-mock-pane is-release-pane">
          <div v-if="releaseLoading" class="figma-mock-empty"><RefreshCw class="is-spin" :size="34" /><span>正在加载发布版本...</span></div>
          <div v-else-if="releases.length" class="figma-mock-release-list">
            <article v-for="release in releases" :key="release.id" class="figma-mock-release-card" :class="{ 'is-active': release.active }">
              <div class="figma-mock-release-card__version"><strong>v{{ release.versionNo }}</strong><small>{{ release.active ? '当前版本' : '已发布' }}</small></div>
              <div class="figma-mock-release-card__content"><strong>{{ releaseTitle(release) }}</strong><p><span>{{ formatDate(release.createdAt) }}</span><i /><span>发布人：—</span><i /><span>接口 / 场景：—</span><template v-if="release.active && activeReferenceItems.length"><i /><span>引用：{{ activeReferenceItems.map(item => item.sourceName || item.sourceType).join('、') }}</span></template></p></div>
              <div class="figma-mock-release-card__actions"><button type="button" class="figma-mock-btn" disabled title="后端暂未提供版本详情接口"><Eye :size="14" />查看</button><button type="button" class="figma-mock-btn" disabled title="后端暂未提供版本对比接口"><RefreshCw :size="14" />对比</button></div>
            </article>
          </div>
          <div v-else class="figma-mock-empty is-design-empty"><ArrowUpRight :size="40" /><strong>尚未发布</strong><span>完成接口和场景配置后，发布为不可变版本供测试环境使用</span><button type="button" class="figma-mock-btn is-primary" @click="emit('publish')"><ArrowUpRight :size="14" />立即发布</button></div>
        </section>

        <section v-else-if="activeTab === 'references'" class="figma-mock-pane is-reference-pane">
          <div v-if="referenceLoading" class="figma-mock-empty"><RefreshCw class="is-spin" :size="34" /><span>正在加载环境引用...</span></div>
          <div v-else-if="activeReferenceItems.length" class="figma-mock-table-wrap">
            <table class="figma-mock-table"><thead><tr><th>环境名称</th><th>使用版本</th><th>Mock 状态</th><th>未匹配策略</th><th>最近使用</th><th class="is-center">关联任务</th><th class="is-right">操作</th></tr></thead><tbody><tr v-for="item in activeReferenceItems" :key="`${item.sourceType}-${item.sourceId}`"><td><strong>{{ item.sourceName || item.sourceType }}</strong></td><td class="is-mono is-muted">—</td><td class="is-muted">—</td><td class="is-muted">—</td><td class="is-muted" :title="item.updatedAt ? `引用更新时间：${formatRelativeTime(item.updatedAt)}` : '后端未提供最近使用时间'">—</td><td class="is-center is-muted">—</td><td class="is-right"><button type="button" class="figma-mock-link" @click="goToEnvironmentConfig">前往环境配置</button></td></tr></tbody></table>
            <div class="figma-mock-table-footer"><span>共 {{ activeReferenceItems.length }} 条</span><button type="button" class="is-active">1</button></div>
          </div>
          <div v-else class="figma-mock-empty is-design-empty"><Globe2 :size="40" /><strong>暂无环境引用</strong><span>在“配置中心 › 环境配置”中选择对应 Mock 版本并启用</span></div>
        </section>

        <section v-else class="figma-mock-pane">
          <div class="figma-mock-toolbar is-log-toolbar">
            <label class="figma-mock-search is-wide"><Search :size="14" /><input v-model="logSearch" type="search" placeholder="搜索路径、场景名"></label>
            <select v-model="logMethod"><option value="ALL">全部方法</option><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select>
            <select v-model="logResult"><option value="ALL">全部结果</option><option value="MATCHED">命中</option><option value="UNMATCHED">未匹配</option></select>
            <select disabled><option>今日</option></select><span class="figma-mock-toolbar__spacer" />
            <button type="button" class="figma-mock-btn" disabled title="后端暂未提供日志导出接口"><Download :size="14" />导出日志</button>
          </div>
          <div v-if="filteredLogs.length" class="figma-mock-table-wrap">
            <table class="figma-mock-table is-log-table"><thead><tr><th>时间</th><th>接口名称</th><th>路径</th><th>命中场景</th><th>结果</th><th class="is-center">状态码</th><th class="is-right">耗时</th><th>关联任务</th><th class="is-right">操作</th></tr></thead><tbody><tr v-for="log in filteredLogs" :key="log.id"><td class="is-mono is-muted">{{ formatDate(log.createdAt).slice(11) }}</td><td><span class="figma-mock-log-endpoint"><span class="figma-mock-method" :class="methodClass(log.httpMethod)">{{ log.httpMethod }}</span>{{ log.endpointName || '—' }}</span></td><td><code>{{ log.requestPath }}</code></td><td>{{ log.scenarioName || '—' }}</td><td><span class="figma-mock-result" :class="`is-${logResultTone(log).tone}`"><component :is="logResultTone(log).icon" :size="13" />{{ logResultTone(log).label }}</span></td><td class="is-center is-mono" :class="`is-${statusCodeTone(log.responseStatus)}`">{{ log.responseStatus || '—' }}</td><td class="is-right is-mono is-muted">—</td><td class="is-muted">—</td><td class="is-right"><button type="button" class="figma-mock-link" @click="emit('open-log', log)">详情</button></td></tr></tbody></table>
            <div class="figma-mock-table-footer"><span>共 {{ filteredLogs.length }} 条</span><button type="button" class="is-active">1</button></div>
          </div>
          <div v-else class="figma-mock-empty"><Search :size="40" /><strong>暂无调用日志</strong><span>Mock 请求产生后将在这里展示命中结果</span></div>
        </section>
      </div>
    </main>

    <main v-else class="figma-mock-main is-empty"><div class="figma-mock-empty"><RefreshCw v-if="loading" class="is-spin" :size="38" /><CircleAlert v-else-if="errorMessage" :size="42" /><Layers v-else :size="42" /><strong>{{ loading ? '正在加载 Mock 服务' : errorMessage ? 'Mock 服务加载失败' : '请选择 Mock 应用' }}</strong><span>{{ errorMessage || (loading ? '正在读取当前工作区数据...' : '从左侧选择应用后维护接口、场景和发布版本') }}</span><button v-if="!loading" type="button" class="figma-mock-btn" @click="emit('refresh')"><RefreshCw :size="14" />{{ errorMessage ? '重试' : '刷新' }}</button></div></main>
  </section>
</template>

<style scoped>
.figma-mock-workspace{display:grid;grid-template-columns:268px minmax(0,1fr);min-height:calc(100vh - 149px);overflow:hidden;background:#f5f6f8;color:#1d2129;font-size:13px}.figma-mock-apps{display:flex;min-height:0;flex-direction:column;padding:14px 10px;border-right:1px solid #e5e6eb;background:#fff}.figma-mock-apps__head{display:flex;height:31px;align-items:center;justify-content:space-between;padding:0 4px;margin-bottom:7px}.figma-mock-apps__head strong{font-size:14px}.figma-mock-btn{display:inline-flex;height:29px;align-items:center;justify-content:center;gap:5px;padding:0 11px;border:1px solid #d9dce3;border-radius:7px;background:#fff;color:#4e5969;cursor:pointer;font:500 12px/1 inherit;white-space:nowrap}.figma-mock-btn:hover:not(:disabled){border-color:#165dff;color:#165dff}.figma-mock-btn:disabled{color:#c9cdd4;cursor:not-allowed}.figma-mock-btn.is-primary{border-color:#165dff;background:#165dff;color:#fff}.figma-mock-btn.is-primary.is-warning{border-color:#ff7d00;background:#ff7d00}.figma-mock-search{display:flex;height:29px;align-items:center;gap:7px;padding:0 10px;border:1px solid #d9dce3;border-radius:7px;background:#fff;color:#86909c}.figma-mock-search:focus-within{border-color:#165dff;box-shadow:0 0 0 2px rgba(22,93,255,.08)}.figma-mock-search input{width:100%;border:0;outline:0;background:transparent;color:#1d2129;font:400 12px inherit}.figma-mock-search input::placeholder{color:#86909c}.figma-mock-search.is-wide{width:220px}.figma-mock-apps__list{display:flex;min-height:0;flex:1;flex-direction:column;gap:5px;overflow:auto;margin-top:10px}.figma-mock-app-card{display:flex;min-height:82px;flex-direction:column;gap:7px;padding:10px 11px;border:1px solid #e5e6eb;border-radius:11px;background:#fff;text-align:left;cursor:pointer}.figma-mock-app-card:hover{border-color:#bed0ff}.figma-mock-app-card.is-active{border-color:#b8d0ff;background:#f2f7ff;box-shadow:0 1px 4px rgba(22,93,255,.05)}.figma-mock-app-card__title{display:flex;align-items:center;justify-content:space-between;gap:8px}.figma-mock-app-card__title>strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.figma-mock-app-card.is-active .figma-mock-app-card__title>strong{color:#165dff}.figma-mock-state{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:10px;font-size:10px;white-space:nowrap}.figma-mock-state i{width:5px;height:5px;border-radius:50%;background:currentColor}.figma-mock-state.is-published{background:#e8ffea;color:#00b42a}.figma-mock-state.is-draft{background:#f2f3f5;color:#86909c}.figma-mock-state.is-disabled{background:#f2f3f5;color:#86909c}.figma-mock-app-card code{color:#c0c4cc;font:11px/1.2 Consolas,monospace}.figma-mock-app-card__meta{display:flex;align-items:center;gap:7px;color:#86909c;font-size:11px}.figma-mock-app-card__meta i,.figma-mock-summary__meta i,.figma-mock-release-card__content p i{width:2px;height:2px;border-radius:50%;background:#c9cdd4}.figma-mock-app-card__meta b{font-weight:600}.is-danger{color:#f53f3f!important}.is-warning{color:#ff7d00!important}.is-success{color:#00b42a!important}.is-muted{color:#86909c!important}.figma-mock-apps__empty,.figma-mock-empty{display:flex;flex:1;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#c9cdd4;text-align:center}.figma-mock-apps__empty strong,.figma-mock-empty strong{color:#4e5969;font-size:14px}.figma-mock-apps__empty span,.figma-mock-empty span{color:#86909c;font-size:12px}.figma-mock-empty .figma-mock-btn{margin-top:8px}.figma-mock-main{display:flex;min-width:0;min-height:0;flex-direction:column;background:#f5f6f8}.figma-mock-main.is-empty{background:#fff}.figma-mock-summary{display:flex;min-height:76px;align-items:center;justify-content:space-between;gap:20px;padding:13px 20px;border-bottom:1px solid #e5e6eb;background:#fff}.figma-mock-summary__identity{display:flex;min-width:0;align-items:center;gap:13px}.figma-mock-summary__icon{display:flex;width:44px;height:44px;flex:0 0 auto;align-items:center;justify-content:center;border-radius:9px;background:#edf3ff;color:#165dff}.figma-mock-summary__title{display:flex;align-items:center;gap:8px}.figma-mock-summary__title h2{margin:0;font-size:17px;line-height:24px}.figma-mock-version,.figma-mock-publish-state{display:inline-flex;padding:2px 7px;border-radius:5px;background:#f2f3f5;color:#86909c;font:11px/1.4 Consolas,monospace}.figma-mock-summary__meta{display:flex;align-items:center;gap:9px;margin-top:4px;color:#86909c;font-size:11px;white-space:nowrap}.figma-mock-summary__meta code{color:#86909c}.figma-mock-summary__meta button{padding:0;border:0;background:none;color:#165dff;cursor:pointer;font:11px Consolas,monospace}.figma-mock-summary__meta b{color:#4e5969;font-weight:500}.figma-mock-summary__actions{display:flex;align-items:center;gap:7px}.figma-mock-stat{display:flex;width:56px;height:47px;align-items:center;justify-content:center;flex-direction:column;border:1px solid #e5e6eb;border-radius:8px;background:#fff}.figma-mock-stat strong{font-size:17px;line-height:19px}.figma-mock-stat small{color:#86909c;font-size:9px}.figma-mock-stat.is-warning{border-color:#ffd09a;background:#fff7e8}.figma-mock-tabs{display:flex;height:36px;align-items:stretch;padding:0 20px;border-bottom:1px solid #e5e6eb;background:#fff}.figma-mock-tabs button{padding:0 14px;border:0;border-bottom:2px solid transparent;background:none;color:#86909c;cursor:pointer;font:500 12px inherit}.figma-mock-tabs button.is-active{border-bottom-color:#4e5ac8;color:#4e5ac8}.figma-mock-content{min-height:0;flex:1;overflow:auto}.figma-mock-pane{padding:20px}.figma-mock-toolbar{display:flex;height:30px;align-items:center;gap:8px;margin-bottom:14px}.figma-mock-toolbar select{height:29px;min-width:100px;padding:0 27px 0 10px;border:1px solid #d9dce3;border-radius:7px;background:#fff;color:#4e5969;font:12px inherit}.figma-mock-toolbar__spacer{flex:1}.figma-mock-endpoints{display:flex;flex-direction:column;gap:8px}.figma-mock-endpoint{overflow:hidden;border:1px solid #e5e6eb;border-radius:11px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.03)}.figma-mock-endpoint.is-expanded{border-color:#b8d0ff;box-shadow:0 2px 12px rgba(22,93,255,.06)}.figma-mock-endpoint__head{display:flex;height:45px;align-items:center;gap:11px;padding:0 14px}.figma-mock-endpoint.is-expanded .figma-mock-endpoint__head{border-bottom:1px solid #e5e6eb;background:#fafbff}.figma-mock-icon-btn,.figma-mock-row-actions button{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;padding:0;border:0;border-radius:5px;background:none;color:#c9cdd4;cursor:pointer}.figma-mock-icon-btn:hover,.figma-mock-row-actions button:hover{background:#f2f3f5;color:#165dff}.figma-mock-row-actions button:last-child:hover{color:#f53f3f}.figma-mock-method{display:inline-flex;min-width:45px;height:18px;align-items:center;justify-content:center;border-radius:4px;font:600 10px/1 Consolas,monospace}.figma-mock-method.is-get{background:#e8ffea;color:#00b42a}.figma-mock-method.is-post{background:#fff3e8;color:#ff7d00}.figma-mock-method.is-put,.figma-mock-method.is-patch{background:#e8f3ff;color:#165dff}.figma-mock-method.is-delete{background:#ffe8e8;color:#f53f3f}.figma-mock-method.is-any{background:#f2f3f5;color:#4e5969}.figma-mock-endpoint__head>code{min-width:0;flex:1;overflow:hidden;color:#1d2129;font:13px Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.figma-mock-endpoint__name{color:#4e5969;white-space:nowrap}.figma-mock-publish-state.is-published{background:#e8ffea;color:#00b42a}.figma-mock-publish-state.is-draft{background:#f2f3f5;color:#86909c}.figma-mock-endpoint__count{color:#86909c;font-size:11px;white-space:nowrap}.figma-mock-endpoint__status{color:#00b42a;font-size:11px}.figma-mock-endpoint__status.is-disabled{color:#c9cdd4}.figma-mock-row-actions{display:flex;align-items:center}.figma-mock-row-actions.is-right{justify-content:flex-end}.figma-mock-scenario-grid{display:grid;min-height:42px;align-items:center;grid-template-columns:minmax(180px,220px) 64px 80px 80px 80px 80px minmax(130px,1fr) 100px;column-gap:12px;padding:0 14px;border-bottom:1px solid #e5e6eb;color:#1d2129;font-size:12px}.figma-mock-scenario-grid:last-child{border-bottom:0}.figma-mock-scenario-grid.is-head{min-height:32px;background:#fafafa;color:#86909c;font-size:10px;font-weight:600;text-transform:uppercase}.figma-mock-scenario-grid.is-head span:last-child{text-align:right}.figma-mock-scenario-name{overflow:hidden;padding:0;border:0;background:none;color:#1d2129;cursor:pointer;font:500 12px inherit;text-align:left;text-overflow:ellipsis;white-space:nowrap}.figma-mock-scenario-name:hover{color:#165dff;text-decoration:underline}.is-mono{font-family:Consolas,monospace}.figma-mock-inline-empty{padding:28px;color:#86909c;text-align:center}.figma-mock-release-list{display:flex;flex-direction:column;gap:11px}.figma-mock-release-card{display:flex;min-height:82px;align-items:center;gap:18px;padding:13px 18px;border:1px solid #e5e6eb;border-radius:11px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.03)}.figma-mock-release-card.is-active{border-color:#9ce5ae;box-shadow:0 1px 8px rgba(0,180,42,.08)}.figma-mock-release-card__version{display:flex;min-width:72px;align-items:center;flex-direction:column}.figma-mock-release-card__version strong{color:#86909c;font:700 20px Consolas,monospace}.figma-mock-release-card.is-active .figma-mock-release-card__version strong{color:#00b42a}.figma-mock-release-card__version small{margin-top:3px;padding:2px 8px;border-radius:9px;background:#f2f3f5;color:#86909c;font-size:9px}.figma-mock-release-card.is-active .figma-mock-release-card__version small{background:#e8ffea;color:#00b42a}.figma-mock-release-card__content{min-width:0;flex:1}.figma-mock-release-card__content>strong{font-size:13px;font-weight:500}.figma-mock-release-card__content p{display:flex;align-items:center;gap:12px;margin:7px 0 0;color:#86909c;font-size:11px}.figma-mock-release-card__actions{display:flex;gap:7px}.figma-mock-table-wrap{overflow:hidden;border:1px solid #e5e6eb;border-radius:11px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.03)}.figma-mock-table{width:100%;border-collapse:collapse;table-layout:fixed}.figma-mock-table th{height:33px;padding:0 14px;border-bottom:1px solid #e5e6eb;background:#fafafa;color:#86909c;font-size:10px;font-weight:600;text-align:left}.figma-mock-table td{height:45px;padding:0 14px;border-bottom:1px solid #e5e6eb;color:#1d2129;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.figma-mock-table tbody tr:last-child td{border-bottom:0}.figma-mock-table tbody tr:hover td{background:#fafbff}.figma-mock-table .is-right{text-align:right}.figma-mock-table .is-center{text-align:center}.figma-mock-table code{font:11px Consolas,monospace;color:#4e5969}.figma-mock-dot-status{display:inline-flex;align-items:center;gap:5px;color:#4e5969}.figma-mock-dot-status i{width:5px;height:5px;border-radius:50%;background:#00b42a}.figma-mock-link{padding:0;border:0;background:none;color:#165dff;cursor:pointer;font:12px inherit}.figma-mock-log-endpoint{display:flex;align-items:center;gap:7px}.figma-mock-result{display:inline-flex;align-items:center;gap:4px}.figma-mock-result.is-success{color:#00b42a}.figma-mock-result.is-warning{color:#ff7d00}.figma-mock-result.is-danger{color:#f53f3f}.is-spin{animation:figma-mock-spin 1s linear infinite}@keyframes figma-mock-spin{to{transform:rotate(360deg)}}@media(max-width:1280px){.figma-mock-workspace{grid-template-columns:240px minmax(0,1fr)}.figma-mock-summary__meta span:nth-of-type(3),.figma-mock-summary__meta i:nth-of-type(3){display:none}.figma-mock-stat{display:none}.figma-mock-scenario-grid{grid-template-columns:minmax(150px,1fr) 55px 65px 65px 55px 65px 110px 88px}}@media(max-width:980px){.figma-mock-workspace{grid-template-columns:1fr;overflow:visible}.figma-mock-apps{max-height:280px;border-right:0;border-bottom:1px solid #e5e6eb}.figma-mock-summary{align-items:flex-start;flex-direction:column}.figma-mock-content{overflow:visible}}
.figma-mock-workspace { height: 533.5px; min-height: 533.5px; }
.figma-mock-summary { min-height: 75.25px; }
.figma-mock-content { margin-top: 1px; }
.figma-mock-workspace { background: #f4f6fa; }
.figma-mock-main { background: #f4f6fa; }
.figma-mock-summary { align-items: flex-start; padding: 14px 21px 13px; }
.figma-mock-summary__identity { align-items: flex-start; gap: 14px; }
.figma-mock-summary__meta { height: 21.5px; align-items: flex-end; margin-top: 0; }
.figma-mock-summary__actions { gap: 7px; }
.figma-mock-summary__separator { width: 1px; height: 28px; background: #e5e6eb; }
.figma-mock-stat { height: 47.25px; }
.figma-mock-summary__actions .figma-mock-btn { width: 67.25px; gap: 5.25px; padding: 0 10.5px; }
.figma-mock-summary__actions .figma-mock-btn.is-primary { width: 111.25px; }
.figma-mock-summary__actions .figma-mock-btn svg { width: 13px; height: 13px; }
.figma-mock-tabs { align-items: flex-end; padding: 0 21px; }
.figma-mock-tabs button { height: 35px; }
.figma-mock-publish-state { font-family: var(--app-font-family); }
.figma-mock-btn { height: 28px; padding: 0 10px; }
.figma-mock-apps__head .figma-mock-btn { width: 61.25px; min-width: 61.25px; padding: 0 9px; }
.figma-mock-search { height: 28px; }
.figma-mock-apps { padding: 14px 10.5px 0; }
.figma-mock-apps__head { height: 28px; padding: 0; margin: 0 3.5px 8.75px; }
.figma-mock-apps > .figma-mock-search { width: auto; margin: 0 3.5px; }
.figma-mock-apps__list { margin-top: 10.5px; gap: 5.25px; }
.figma-mock-app-card { height: 81.5px; min-height: 81.5px; gap: 0; padding: 8.75px 10.5px 8.25px; }
.figma-mock-app-card__title { height: 20.25px; gap: 5.25px; }
.figma-mock-app-card .figma-mock-state { gap: 3.5px; padding: 1.75px 5.25px; }
.figma-mock-app-card .figma-mock-state i { width: 5.25px; height: 5.25px; }
.figma-mock-app-card code { margin-top: 3.5px; }
.figma-mock-app-card__meta { margin-top: 4.75px; }
.figma-mock-pane { padding: 17.5px; }
.figma-mock-toolbar { height: 32px; gap: 7px; margin-bottom: 14px; }
.figma-mock-toolbar select { height: 28px; }
.figma-mock-toolbar.is-log-toolbar { height: 28px; }
.figma-mock-toolbar.is-log-toolbar select:nth-of-type(1),
.figma-mock-toolbar.is-log-toolbar select:nth-of-type(2) { width: 100px; min-width: 100px; }
.figma-mock-toolbar.is-log-toolbar select:nth-of-type(3) { width: 120px; min-width: 120px; }
.figma-mock-toolbar.is-log-toolbar .figma-mock-btn { width: 93.25px; gap: 5.25px; padding: 0 10.5px; }
.figma-mock-toolbar.is-log-toolbar .figma-mock-btn svg { width: 13px; height: 13px; }
.figma-mock-toolbar:not(.is-log-toolbar) select:nth-of-type(1) { width: 100px; min-width: 100px; }
.figma-mock-toolbar:not(.is-log-toolbar) select:nth-of-type(2) { width: 110px; min-width: 110px; }
.figma-mock-toolbar:not(.is-log-toolbar) select:nth-of-type(3) { width: 100px; min-width: 100px; }
.figma-mock-toolbar:not(.is-log-toolbar) .figma-mock-btn:not(.is-primary) { width: 67.25px; gap: 5.25px; padding: 0 10.5px; }
.figma-mock-toolbar:not(.is-log-toolbar) .figma-mock-btn.is-primary { width: 98.25px; height: 32px; min-height: 32px; gap: 5.25px; padding: 0 13px; }
.figma-mock-toolbar:not(.is-log-toolbar) .figma-mock-btn svg { width: 13px; height: 13px; }
.figma-mock-state.is-enabled { background: #e8ffea; color: #00b42a; }
.figma-mock-release-list { gap: 10.5px; }
.figma-mock-release-card { gap: 14px; padding: 13px 17.5px; }
.figma-mock-release-card__actions { gap: 7px; }
.figma-mock-release-card__actions .figma-mock-btn { width: 67.25px; gap: 5.25px; padding: 0 10.5px; }
.figma-mock-release-card__actions .figma-mock-btn svg { width: 13px; height: 13px; }
.figma-mock-release-card__content p { flex-wrap: wrap; row-gap: 4px; }
.figma-mock-release-card__actions { flex: 0 0 auto; }
.figma-mock-table-footer { display: flex; height: 43px; align-items: center; justify-content: space-between; padding: 0 14px; border-top: 1px solid #e5e6eb; color: #86909c; font-size: 11px; }
.figma-mock-table-footer button { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; font: 12px inherit; }
.figma-mock-table-footer button.is-active { border-color: #165dff; color: #165dff; }
.figma-mock-table.is-log-table th:nth-child(1),.figma-mock-table.is-log-table td:nth-child(1){width:8%}
.figma-mock-table.is-log-table th:nth-child(2),.figma-mock-table.is-log-table td:nth-child(2){width:16%}
.figma-mock-table.is-log-table th:nth-child(3),.figma-mock-table.is-log-table td:nth-child(3){width:18%}
.figma-mock-table.is-log-table th:nth-child(4),.figma-mock-table.is-log-table td:nth-child(4){width:16%}
.figma-mock-table.is-log-table th:nth-child(5),.figma-mock-table.is-log-table td:nth-child(5){width:8%}
.figma-mock-table.is-log-table th:nth-child(6),.figma-mock-table.is-log-table td:nth-child(6){width:7%}
.figma-mock-table.is-log-table th:nth-child(7),.figma-mock-table.is-log-table td:nth-child(7){width:7%}
.figma-mock-table.is-log-table th:nth-child(8),.figma-mock-table.is-log-table td:nth-child(8){width:11%}
.figma-mock-table.is-log-table th:nth-child(9),.figma-mock-table.is-log-table td:nth-child(9){width:8%}
.figma-mock-table:not(.is-log-table) th:nth-child(1),.figma-mock-table:not(.is-log-table) td:nth-child(1){width:16%}
.figma-mock-table:not(.is-log-table) th:nth-child(2),.figma-mock-table:not(.is-log-table) td:nth-child(2){width:10%}
.figma-mock-table:not(.is-log-table) th:nth-child(3),.figma-mock-table:not(.is-log-table) td:nth-child(3){width:10%}
.figma-mock-table:not(.is-log-table) th:nth-child(4),.figma-mock-table:not(.is-log-table) td:nth-child(4){width:14%}
.figma-mock-table:not(.is-log-table) th:nth-child(5),.figma-mock-table:not(.is-log-table) td:nth-child(5){width:14%}
.figma-mock-table:not(.is-log-table) th:nth-child(6),.figma-mock-table:not(.is-log-table) td:nth-child(6){width:10%}
.figma-mock-table:not(.is-log-table) th:nth-child(7),.figma-mock-table:not(.is-log-table) td:nth-child(7){width:10%}

.figma-mock-btn {
  transition: border-color 150ms, color 150ms, filter 150ms, transform 150ms;
}

.figma-mock-btn:not(.is-primary):hover:not(:disabled) {
  border-color: #165dff;
  color: #165dff;
}

.figma-mock-btn.is-primary:hover:not(:disabled) {
  color: #fff !important;
  filter: brightness(1.1);
}

.figma-mock-btn.is-primary:active:not(:disabled) {
  transform: scale(.98);
}

/* Mock typography restoration: Figma 342:18262 / 18977 / 25327 / 25890 / 26394. */
.figma-mock-workspace {
  font-family: var(--app-font-family);
}

.figma-mock-apps__head strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.figma-mock-btn {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-apps__head .figma-mock-btn {
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-search input,
.figma-mock-toolbar select {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
}

.figma-mock-app-card__title > strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 17.5px;
}

.figma-mock-app-card .figma-mock-state {
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.figma-mock-app-card code {
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
}

.figma-mock-app-card__meta {
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
}

.figma-mock-app-card__meta b {
  font-weight: 600;
}

.figma-mock-summary__title h2 {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.figma-mock-summary__title .figma-mock-state {
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.figma-mock-version {
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-publish-state {
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-summary__meta {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-summary__meta code,
.figma-mock-summary__meta button {
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-stat strong {
  font-size: 18px;
  font-weight: 700;
  line-height: 18px;
}

.figma-mock-stat small {
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.figma-mock-tabs button {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-endpoint__head {
  height: 45.5px;
  gap: 10.5px;
}

.figma-mock-endpoint.is-expanded .figma-mock-endpoint__head {
  height: 46.5px;
}

.figma-mock-icon-btn {
  width: 17.5px;
  height: 17.5px;
}

.figma-mock-icon-btn svg {
  width: 14px;
  height: 14px;
}

.figma-mock-row-actions button {
  width: 24.5px;
  height: 24.5px;
}

.figma-mock-publish-state {
  padding: 2px 5.25px;
}

.figma-mock-method {
  width: 46px;
  min-width: 46px;
  height: 17px;
  font-family: var(--app-font-family);
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.figma-mock-endpoint__head > code {
  font-family: var(--app-font-family-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-endpoint__name {
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-endpoint__count,
.figma-mock-endpoint__status {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-scenario-grid {
  height: 43px;
  min-height: 43px;
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-scenario-grid.is-head {
  height: 31.5px;
  min-height: 31.5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
}

.figma-mock-scenario-name {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-scenario-grid .figma-mock-row-actions {
  justify-content: space-between;
}

.figma-mock-scenario-grid .figma-mock-row-actions button {
  width: 23.6875px;
}

.is-mono {
  font-family: var(--app-font-family-mono);
}

.figma-mock-release-card__version strong {
  font-family: var(--app-font-family-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.figma-mock-release-card__version small {
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.figma-mock-release-card__content > strong {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-release-card__content p {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-table th {
  height: 34.5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
}

.figma-mock-table:not(.is-log-table) td {
  height: 46px;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-mock-table.is-log-table td {
  height: 46px;
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-table:not(.is-log-table) td strong {
  font-weight: 500;
}

.figma-mock-table:not(.is-log-table) code {
  font-family: var(--app-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-mock-table.is-log-table code {
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-table.is-log-table .is-mono:not(.is-muted) {
  font-weight: 600;
}

.figma-mock-link {
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-table-footer {
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-table-footer button {
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-pane.is-interface-pane.is-empty-state {
  padding-top: 19.5px;
}

.figma-mock-pane.is-interface-pane > .figma-mock-empty.is-design-empty {
  display: none;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty,
.figma-mock-pane.is-reference-pane > .figma-mock-empty.is-design-empty {
  box-sizing: border-box;
  flex: none;
  justify-content: flex-start;
  gap: 0;
  padding-top: 87.5px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty {
  height: 316px;
}

.figma-mock-pane.is-reference-pane > .figma-mock-empty.is-design-empty {
  height: 270px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty > svg,
.figma-mock-pane.is-reference-pane > .figma-mock-empty.is-design-empty > svg {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty > strong,
.figma-mock-pane.is-reference-pane > .figma-mock-empty.is-design-empty > strong {
  height: 21px;
  margin-top: 10.5px;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty > span,
.figma-mock-pane.is-reference-pane > .figma-mock-empty.is-design-empty > span {
  display: flex;
  height: 23.5px;
  align-items: flex-end;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty > .figma-mock-btn {
  width: 98.25px;
  height: 32px;
  min-height: 32px;
  margin-top: 14px;
  padding: 0 13px;
  gap: 5.25px;
}

.figma-mock-pane.is-release-pane > .figma-mock-empty.is-design-empty > .figma-mock-btn svg {
  width: 13px;
  height: 13px;
}
</style>
