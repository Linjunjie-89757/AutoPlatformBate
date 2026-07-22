<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, Play, Search, Trash2 } from '@lucide/vue'
import WebUiModuleTabs from './WebUiModuleTabs.vue'

type RunStatus = 'pass' | 'fail' | 'running'

type RunRecord = {
  id: string
  status: RunStatus
  caseName: string
  environment: string
  browser: string
  startedAt: string
  duration: string
  passedSteps: number | null
  failedSteps: number | null
}

const runs: RunRecord[] = [
  { id: 'run-001', status: 'pass', caseName: '用户登录正常流程', environment: '测试环境', browser: 'Chrome 126', startedAt: '2026-07-05 14:30:05', duration: '8.3s', passedSteps: 9, failedSteps: 0 },
  { id: 'run-002', status: 'fail', caseName: '商品搜索与筛选', environment: '测试环境', browser: 'Chrome 126', startedAt: '2026-07-05 11:20:33', duration: '12.7s', passedSteps: 3, failedSteps: 1 },
  { id: 'run-003', status: 'pass', caseName: '购物车加购与结算', environment: '测试环境', browser: 'Chrome 126', startedAt: '2026-07-04 16:45:12', duration: '15.2s', passedSteps: null, failedSteps: null },
  { id: 'run-004', status: 'running', caseName: '订单状态流转核心路径', environment: '预发布环境', browser: 'Chrome 126', startedAt: '2026-07-05 15:00:00', duration: '—', passedSteps: null, failedSteps: null },
]

const keyword = ref('')
const status = ref<'all' | RunStatus>('all')
const environment = ref('all')
const browser = ref('all')
const selectedRunId = ref<string | null>(null)

const stats = computed(() => [
  { label: '全部执行', value: runs.length, color: '#1d2129' },
  { label: '通过', value: runs.filter(item => item.status === 'pass').length, color: '#00b42a' },
  { label: '失败', value: runs.filter(item => item.status === 'fail').length, color: '#f53f3f' },
  { label: '运行中', value: runs.filter(item => item.status === 'running').length, color: '#0fc6c2' },
])

const filteredRuns = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  return runs.filter((item) => {
    if (term && !item.caseName.toLowerCase().includes(term)) return false
    if (status.value !== 'all' && item.status !== status.value) return false
    if (environment.value !== 'all' && item.environment !== environment.value) return false
    return browser.value === 'all' || item.browser.startsWith(browser.value)
  })
})

function statusLabel(value: RunStatus) {
  return value === 'pass' ? '通过' : value === 'fail' ? '失败' : '运行中'
}

function viewRun(item: RunRecord) {
  selectedRunId.value = item.id
}

function isDefaultFilter(value: string) {
  return value === 'all'
}
</script>

<template>
  <section class="web-ui-runs-page">
    <WebUiModuleTabs active="records" />

    <header class="web-ui-runs-page__stats">
      <div v-for="(item, index) in stats" :key="item.label" class="web-ui-runs-stat">
        <i v-if="index" />
        <strong :style="{ color: item.color }">{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
      <div class="web-ui-runs-page__spacer" />
      <button class="web-ui-runs-batch" type="button"><Play />批量执行</button>
    </header>

    <div class="web-ui-runs-page__filters">
      <label class="web-ui-runs-search"><Search /><input v-model="keyword" placeholder="搜索用例名称" /></label>
      <select v-model="status" :class="{ 'is-default': isDefaultFilter(status) }" aria-label="执行状态"><option value="all">全部状态</option><option value="pass">通过</option><option value="fail">失败</option><option value="running">运行中</option></select>
      <select v-model="environment" :class="{ 'is-default': isDefaultFilter(environment) }" aria-label="执行环境"><option value="all">全部环境</option><option>测试环境</option><option>预发布环境</option></select>
      <select v-model="browser" :class="{ 'is-default': isDefaultFilter(browser) }" aria-label="浏览器"><option value="all">全部浏览器</option><option>Chrome</option><option>Firefox</option></select>
    </div>

    <main class="web-ui-runs-page__content">
      <section class="web-ui-runs-table">
        <header class="web-ui-runs-table__head">
          <span>状态</span><span>用例名称</span><span>执行环境</span><span>浏览器</span><span>开始时间</span><span>耗时</span><span>步骤</span><span>操作</span>
        </header>
        <div class="web-ui-runs-table__body">
          <article v-for="item in filteredRuns" :key="item.id" class="web-ui-runs-row" :class="{ 'is-selected': selectedRunId === item.id }" tabindex="0" @click="viewRun(item)" @keydown.enter="viewRun(item)">
            <span><b class="web-ui-run-badge" :class="item.status">{{ statusLabel(item.status) }}</b></span>
            <strong>{{ item.caseName }}</strong>
            <span class="is-muted">{{ item.environment }}</span>
            <span class="is-muted">{{ item.browser }}</span>
            <time>{{ item.startedAt }}</time>
            <time>{{ item.duration }}</time>
            <span class="web-ui-runs-steps">
              <template v-if="item.passedSteps !== null"><b>{{ item.passedSteps }}✓</b><em v-if="item.failedSteps">{{ item.failedSteps }}✗</em></template>
              <i v-else>—</i>
            </span>
            <span class="web-ui-runs-actions">
              <button type="button" title="查看详情" aria-label="查看详情" @click.stop="viewRun(item)"><Eye /></button>
              <button type="button" title="重跑" aria-label="重跑" @click.stop><Play /></button>
              <button type="button" title="删除" aria-label="删除" @click.stop><Trash2 /></button>
            </span>
          </article>
          <p v-if="!filteredRuns.length" class="web-ui-runs-empty">暂无匹配的执行记录</p>
        </div>
        <footer class="web-ui-runs-table__footer"><span>共 {{ filteredRuns.length }} 条</span><button type="button" aria-current="page">1</button></footer>
      </section>
    </main>
  </section>
</template>

<style scoped>
.web-ui-runs-page { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; color: #1d2129; font-family: Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-page__stats { display: flex; box-sizing: border-box; height: 55px; flex: 0 0 auto; align-items: center; gap: 14px; padding: 0 21px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.web-ui-runs-stat { display: inline-flex; align-items: center; gap: 7px; }
.web-ui-runs-stat > i { width: 1px; height: 14px; margin-right: 1px; background: #e5e6eb; }
.web-ui-runs-stat strong { font-size: 22px; font-weight: 700; line-height: 33px; }
.web-ui-runs-stat span { color: #86909c; font-size: 12px; font-weight: 400; line-height: 18px; }
.web-ui-runs-page__spacer { flex: 1; }
.web-ui-runs-batch { display: inline-flex; box-sizing: border-box; height: 32px; align-items: center; gap: 5px; padding: 0 14px; border: 0; border-radius: 8px; background: #0fc6c2; color: #fff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-batch svg { width: 13px; height: 13px; }
.web-ui-runs-batch:hover { background: #0bb7b3; }
.web-ui-runs-page__filters { display: flex; box-sizing: border-box; height: 46.5px; flex: 0 0 auto; align-items: center; gap: 7px; padding: 0 21px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.web-ui-runs-page__filters select, .web-ui-runs-search { box-sizing: border-box; height: 28px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-search { position: relative; display: inline-flex; width: 200px; align-items: center; }
.web-ui-runs-search svg { width: 13px; height: 13px; margin-left: 8.75px; color: #86909c; }
.web-ui-runs-search input { width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: inherit; }
.web-ui-runs-search input::placeholder { color: rgba(29, 33, 41, .5); }
.web-ui-runs-page__filters select { appearance: none; padding: 0 8px; }
.web-ui-runs-page__filters select.is-default { color: transparent; }
.web-ui-runs-page__filters select option { color: #4e5969; }
.web-ui-runs-page__filters select:nth-of-type(1) { width: 110px; }
.web-ui-runs-page__filters select:nth-of-type(2), .web-ui-runs-page__filters select:nth-of-type(3) { width: 120px; }
.web-ui-runs-page__content { min-height: 0; flex: 1; overflow-y: auto; padding: 14px 21px; background: #f4f6fa; }
.web-ui-runs-table { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .04); }
.web-ui-runs-table__head, .web-ui-runs-row { display: grid; grid-template-columns: 8% 24% 11% 10% 15% 8% 9% 15%; align-items: center; }
.web-ui-runs-table__head { box-sizing: border-box; height: 34.5px; border-bottom: 1px solid #e5e6eb; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; letter-spacing: .275px; line-height: 16.5px; }
.web-ui-runs-table__head > span { padding: 0 14px; }
.web-ui-runs-table__head > span:last-child { text-align: right; }
.web-ui-runs-row { box-sizing: border-box; height: 46px; border-bottom: 1px solid #e5e6eb; background: #fff; color: #86909c; font-size: 13px; line-height: 20px; transition: background .15s ease; }
.web-ui-runs-row:hover, .web-ui-runs-row:focus, .web-ui-runs-row.is-selected { outline: 0; background: #fafcff; }
.web-ui-runs-row > span, .web-ui-runs-row > strong, .web-ui-runs-row > time { min-width: 0; padding: 0 14px; }
.web-ui-runs-row > strong { overflow: hidden; color: #165dff; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-runs-row .is-muted { color: #86909c; }
.web-ui-runs-row time { color: #86909c; font-family: var(--app-font-family-mono); font-size: 13px; font-weight: 400; line-height: 19.5px; white-space: nowrap; }
.web-ui-run-badge { display: inline-flex; box-sizing: border-box; height: 20px; align-items: center; padding: 0 7px; border-radius: 3.5px; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.web-ui-run-badge.pass { background: #e8ffea; color: #00b42a; }
.web-ui-run-badge.fail { background: #ffe8e8; color: #f53f3f; }
.web-ui-run-badge.running { background: #e8f3ff; color: #165dff; }
.web-ui-runs-steps { font-family: Inter, "Noto Sans SC", sans-serif; font-size: 12px; line-height: 18px; }
.web-ui-runs-steps b { color: #00b42a; font-weight: 500; }
.web-ui-runs-steps em { margin-left: 5px; color: #f53f3f; font-style: normal; font-weight: 500; }
.web-ui-runs-steps i { color: #c9cdd4; font-style: normal; }
.web-ui-runs-actions { display: inline-flex; justify-content: flex-end; gap: 0; padding-right: 14px !important; }
.web-ui-runs-actions button { display: inline-flex; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #c9cdd4; cursor: pointer; }
.web-ui-runs-actions button:hover { background: #f2f3f5; color: #4e5969; }
.web-ui-runs-actions button:last-child:hover { background: #fff0f0; color: #f53f3f; }
.web-ui-runs-actions svg { width: 13px; height: 13px; }
.web-ui-runs-empty { margin: 0; padding: 48px 0; color: #86909c; font-size: 13px; text-align: center; }
.web-ui-runs-table__footer { display: flex; box-sizing: border-box; height: 43px; align-items: center; justify-content: space-between; padding: 0 14px; color: #86909c; font-size: 12px; line-height: 18px; }
.web-ui-runs-table__footer button { display: inline-flex; box-sizing: border-box; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 1px solid #165dff; border-radius: 5px; background: #165dff; color: #fff; font: 500 12px/18px Inter, sans-serif; }
@media (max-width: 1080px) { .web-ui-runs-table__head, .web-ui-runs-row { grid-template-columns: 10% 28% 14% 13% 18% 17%; } .web-ui-runs-table__head > span:nth-child(4), .web-ui-runs-table__head > span:nth-child(7), .web-ui-runs-row > span:nth-child(4), .web-ui-runs-row > span:nth-child(7) { display: none; } .web-ui-runs-page__filters select:nth-of-type(3) { display: none; } }
</style>
