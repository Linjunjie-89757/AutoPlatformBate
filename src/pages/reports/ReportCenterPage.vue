<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Filter, Sparkles } from '@lucide/vue'
import { useRouter } from 'vue-router'

import { figmaReportIcons } from '@/shared/assets/figma-icons'

type PageMode = 'list' | 'detail'
type ReportTab = 'list' | 'share'
type ReportStatus = 'success' | 'failed' | 'interrupted'
type StepStatus = 'success' | 'failed' | 'skipped'
type DrawerTab = 'request' | 'response' | 'assertion' | 'log' | 'ai'

interface SummaryCard {
  label: string
  value: string
  tone: 'default' | 'success' | 'danger' | 'warning'
}

interface ReportRow {
  id: string
  name: string
  trigger: string
  type: string
  typeTone: 'blue' | 'cyan' | 'purple'
  status: ReportStatus
  passRate: number
  steps: {
    success: number
    failed?: number
    skipped?: number
  }
  duration: string
  executor: string
  env: string
}

interface ReportStep {
  id: number
  title: string
  method?: 'GET' | 'POST' | 'DELETE'
  duration: string
  status: StepStatus
}

interface StepAssertion {
  path: string
  op: string
  expected: string
  actual: string
  pass: boolean
}

const pageMode = ref<PageMode>('list')
const activeTab = ref<ReportTab>('list')
const drawerVisible = ref(false)
const activeDrawerTab = ref<DrawerTab>('request')
const selectedStepId = ref<number | null>(null)
const drawerStepId = ref<number | null>(null)
const failOnly = ref(false)
const detailAiExpanded = ref(true)
const drawerAiExpanded = ref(true)
const copiedCodeBlockKey = ref('')
const copiedResetTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
const router = useRouter()

const summaryCards: SummaryCard[] = [
  { label: '全部报告', value: '7', tone: 'default' },
  { label: '成功', value: '3', tone: 'success' },
  { label: '失败', value: '3', tone: 'danger' },
  { label: '中断 / 执行中', value: '1', tone: 'warning' },
]

const reportRows: ReportRow[] = [
  {
    id: 'RPT-2026-0703-001',
    name: '订单中心-主流程回归',
    trigger: '手动',
    type: '接口套件',
    typeTone: 'blue',
    status: 'success',
    passRate: 100,
    steps: { success: 48 },
    duration: '2m 34s',
    executor: '张程远',
    env: '测试环境',
  },
  {
    id: 'RPT-2026-0703-002',
    name: '风控中心-黑名单拦截场景',
    trigger: 'CI/CD',
    type: '接口场景',
    typeTone: 'blue',
    status: 'failed',
    passRate: 50,
    steps: { success: 4, failed: 3, skipped: 1 },
    duration: '48s',
    executor: '李明',
    env: '预发布',
  },
  {
    id: 'RPT-2026-0703-003',
    name: '用户中心-注册登录 UI 套件',
    trigger: '定时',
    type: 'Web UI 套件',
    typeTone: 'purple',
    status: 'failed',
    passRate: 80,
    steps: { success: 28, failed: 7 },
    duration: '5m 12s',
    executor: '王芳',
    env: '测试环境',
  },
  {
    id: 'RPT-2026-0703-004',
    name: '获客中心-产品新增 UI 用例',
    trigger: '手动',
    type: 'Web UI 用例',
    typeTone: 'cyan',
    status: 'success',
    passRate: 100,
    steps: { success: 18 },
    duration: '1m 05s',
    executor: '张程远',
    env: '测试环境',
  },
  {
    id: 'RPT-2026-0702-001',
    name: '获客中心-全量回归套件',
    trigger: 'CI/CD',
    type: '接口套件',
    typeTone: 'blue',
    status: 'failed',
    passRate: 88,
    steps: { success: 56, failed: 8 },
    duration: '4m 18s',
    executor: '陈伟',
    env: '预发布',
  },
  {
    id: 'RPT-2026-0702-002',
    name: '风控统计-只读查询场景',
    trigger: '手动',
    type: '接口场景',
    typeTone: 'blue',
    status: 'success',
    passRate: 100,
    steps: { success: 6 },
    duration: '12s',
    executor: '李明',
    env: '生产环境',
  },
  {
    id: 'RPT-2026-0701-001',
    name: '订单退款流程-异常分支',
    trigger: '手动',
    type: '接口场景',
    typeTone: 'blue',
    status: 'interrupted',
    passRate: 25,
    steps: { success: 2, failed: 2, skipped: 4 },
    duration: '22s',
    executor: '张程远',
    env: '测试环境',
  },
]

const reportSteps: ReportStep[] = [
  { id: 1, title: 'POST /api/auth/login', method: 'POST', duration: '120ms', status: 'success' },
  { id: 2, title: 'POST /api/risk/blacklist/add', method: 'POST', duration: '85ms', status: 'success' },
  { id: 3, title: 'GET /api/risk/blacklist/query', method: 'GET', duration: '67ms', status: 'success' },
  { id: 4, title: 'POST /api/orders/create（黑名单用户下单）', method: 'POST', duration: '210ms', status: 'failed' },
  { id: 5, title: 'POST /api/risk/blacklist/remove', duration: '—', status: 'skipped' },
  { id: 6, title: 'GET /api/risk/blacklist/query（验证移除）', duration: '—', status: 'skipped' },
  { id: 7, title: 'DELETE /api/test/cleanup', method: 'DELETE', duration: '315ms', status: 'failed' },
  { id: 8, title: 'GET /api/orders/list（验证无残留订单）', method: 'GET', duration: '74ms', status: 'failed' },
]

const reportAiAnalysis = {
  summary: '风控中间件未在预发布环境正确拦截黑名单用户下单，接口返回 200 而非预期 403，表明黑名单校验逻辑未在该环境生效。',
  basis: [
    '步骤 2 成功将 userId=99999 写入黑名单，blacklistId=5501 表明入库成功',
    '步骤 3 查询确认 inBlacklist=true，黑名单数据写入正确',
    '步骤 4 下单请求接口返回 code=0 而非 403，风控拦截未被触发',
    '响应体包含正常 orderId，表明订单已实际创建成功',
  ],
  suggestions: [
    '检查预发布环境风控中间件是否已部署最新版本',
    '对比测试环境与预发布环境 risk-middleware 配置差异',
    '排查黑名单缓存同步（预发布可能使用独立 Redis 实例）',
    '联系后端确认 /api/orders/create 在预发布的中间件链路是否完整',
  ],
}

const selectedStep = computed(() => reportSteps.find((step) => step.id === selectedStepId.value) ?? null)
const drawerStep = computed(() => reportSteps.find((step) => step.id === drawerStepId.value) ?? null)
const failStepCount = computed(() => reportSteps.filter((step) => step.status === 'failed').length)
const visibleReportSteps = computed(() => (failOnly.value ? reportSteps.filter((step) => step.status === 'failed') : reportSteps))

function statusLabel(status: ReportStatus) {
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  return '已中断'
}

function stepStatusLabel(status: StepStatus) {
  if (status === 'success') return '执行通过'
  if (status === 'failed') return '执行失败'
  return '已跳过'
}

function stepAssertionCount(status: StepStatus) {
  if (status === 'skipped') return 0
  return 2
}

function stepAssertions(step: ReportStep): StepAssertion[] {
  if (step.status === 'skipped') return []
  if (step.status === 'failed') {
    return [
      { path: '$.code', op: '等于', expected: step.id === 4 ? '403' : '0', actual: step.id === 4 ? '0' : '500', pass: false },
      { path: step.id === 4 ? '$.message' : '$.trace', op: step.id === 4 ? '包含' : '存在', expected: step.id === 4 ? 'blacklist' : '—', actual: step.id === 4 ? 'success' : 'NullPointerException', pass: false },
    ]
  }
  return [
    { path: '$.code', op: '等于', expected: '0', actual: '0', pass: true },
    { path: '$.data.token', op: '存在', expected: '—', actual: 'eyJhbGci...', pass: true },
  ]
}

function stepUrl(step: ReportStep) {
  if (!step.method) return ''
  const path = step.title.replace(`${step.method} `, '').split('（')[0]
  return `https://staging-api.company.com${path}`
}

function stepRequestBody(step: ReportStep) {
  if (step.status === 'skipped') return ''
  if (step.id === 4) {
    return `{
  "userId": 10042,
  "skuId": "SKU-RISK-001",
  "amount": 1
}`
  }
  if (step.id === 1) {
    return `{
  "username": "qatest001",
  "password": "Test@1234"
}`
  }
  return ''
}

function stepStatusCode(step: ReportStep) {
  if (step.status === 'skipped') return '—'
  return step.status === 'success' ? '200' : step.id === 7 ? '500' : '200'
}

function stepStatusCodeTone(step: ReportStep) {
  const code = Number(stepStatusCode(step))
  if (Number.isNaN(code)) return 'muted'
  return code < 300 ? 'success' : 'failed'
}

function stepResponseDuration(step: ReportStep) {
  const durationMap: Record<number, string> = {
    1: '98ms',
    2: '62ms',
    3: '51ms',
    4: '188ms',
    7: '290ms',
    8: '61ms',
  }
  return durationMap[step.id] ?? step.duration
}

function stepResponseBody(step: ReportStep) {
  if (step.id === 7) {
    return `{
  "code": 500,
  "message": "Internal Server Error",
  "trace": "NullPointerException at com.company.cleanup.CleanupService:142"
}`
  }
  if (step.status === 'failed') {
    return `{
  "code": 0,
  "message": "success",
  "data": {
    "orderId": "ORD-20260703-99001"
  }
}`
  }
  return `{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": 10042,
    "role": "user"
  }
}`
}

function stepLog(step: ReportStep) {
  if (step.status !== 'failed') return ''
  if (step.id === 4) {
    return `[2026-07-03 13:30:38.214] [ASSERT FAIL] Step 4: POST /api/orders/create
断言失败: $.code 期望 403，实际 0
断言失败: $.message 期望包含 "blacklist"，实际 "success"

环境: 预发布 (https://staging-api.company.com)
推断: 预发布环境风控中间件未正确拦截黑名单用户下单请求。`
  }
  return `[2026-07-03 13:31:02.451] [ASSERT FAIL] Step ${step.id}: ${step.title}
断言失败: 请求返回异常。`
}

function passTone(row: ReportRow) {
  if (row.status === 'success') return 'success'
  if (row.status === 'failed') return row.passRate >= 80 ? 'warning' : 'danger'
  return 'danger'
}

function reportTypeBadgeWidth(type: string) {
  if (type === 'Web UI 套件') return '76.75px'
  if (type === 'Web UI 用例') return '70.5px'
  return '58px'
}

function reportEnvBadgeWidth(env: string) {
  return env === '预发布' ? '40.5px' : '50.5px'
}

function selectReport() {
  pageMode.value = 'detail'
  selectedStepId.value = null
  drawerStepId.value = null
  drawerVisible.value = false
  failOnly.value = false
}

function backToList() {
  pageMode.value = 'list'
  selectedStepId.value = null
  drawerStepId.value = null
  drawerVisible.value = false
  failOnly.value = false
}

function selectStep(step: ReportStep) {
  selectedStepId.value = step.id
  drawerVisible.value = false
}

function openDrawer(tab: DrawerTab = 'request', step: ReportStep | null = selectedStep.value) {
  if (!step) return
  drawerStepId.value = step.id
  activeDrawerTab.value = step.status === 'skipped' && tab === 'response' ? 'request' : tab
  drawerVisible.value = true
}

function openStepDrawer(step: ReportStep, tab: DrawerTab = 'request') {
  selectedStepId.value = step.id
  openDrawer(tab, step)
}

function closeDrawer() {
  drawerVisible.value = false
  drawerStepId.value = null
}

function openSharedReport() {
  void router.push({ name: 'report-shared-report' })
}

async function copyReportCodeBlock(key: string, text = '') {
  await copyText(text)
  copiedCodeBlockKey.value = key

  const currentTimer = copiedResetTimers.get(key)
  if (currentTimer) window.clearTimeout(currentTimer)

  const nextTimer = window.setTimeout(() => {
    if (copiedCodeBlockKey.value === key) copiedCodeBlockKey.value = ''
    copiedResetTimers.delete(key)
  }, 1500)

  copiedResetTimers.set(key, nextTimer)
}

async function copyText(text = '') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}
</script>

<template>
  <section class="report-center-page">
    <template v-if="pageMode === 'list'">
      <nav class="report-module-tabs" aria-label="报告中心页面">
        <button type="button" :class="{ 'is-active': activeTab === 'list' }" @click="activeTab = 'list'">报告列表</button>
        <button type="button" :class="{ 'is-active': activeTab === 'share' }" @click="activeTab = 'share'">分享报告</button>
      </nav>

      <div v-if="activeTab === 'list'" class="report-list-page">
        <div class="report-summary-grid">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="report-summary-card"
            :class="`is-${card.tone}`"
          >
            <strong>{{ card.value }}</strong>
            <span>{{ card.label }}</span>
          </article>
        </div>

        <div class="report-list-toolbar">
          <div class="report-filter-group">
            <label class="report-search-field">
              <img :src="figmaReportIcons.listSearch" alt="">
              <input type="text" placeholder="搜索报告名称或 ID">
            </label>
            <button type="button" class="report-filter-select" aria-label="报告类型"></button>
            <button type="button" class="report-filter-select" aria-label="报告状态"></button>
          </div>
          <div class="report-list-actions">
            <button type="button" class="report-light-button">
              <img :src="figmaReportIcons.action.batchExport" alt="">
              <span>批量导出</span>
            </button>
            <button type="button" class="report-primary-button">
              <img :src="figmaReportIcons.action.runNow" alt="">
              <span>立即执行</span>
            </button>
          </div>
        </div>

        <section class="report-table-panel" aria-label="报告列表">
          <div class="report-table-canvas">
            <div class="report-table__header">
              <span class="is-id">报告 ID</span>
              <span class="is-name">报告名称 / 触发</span>
              <span class="is-type">类型</span>
              <span class="is-status">状态</span>
              <span class="is-pass">通过率</span>
              <span class="is-steps">步骤统计</span>
              <span class="is-duration">耗时</span>
              <span class="is-executor">执行人</span>
              <span class="is-env">环境</span>
              <span class="is-start">开始时间</span>
            </div>

            <div
              v-for="(row, index) in reportRows"
              :key="row.id"
              class="report-table__row"
              :class="{ 'is-last': index === reportRows.length - 1 }"
              :style="{ top: `${34.5 + index * 54}px`, height: index === reportRows.length - 1 ? '53.5px' : '54px' }"
              @click="selectReport"
            >
              <span class="report-id">{{ row.id }}</span>
              <span class="report-name-cell">
                <strong>{{ row.name }}</strong>
                <small>{{ row.trigger }}</small>
              </span>
              <span
                class="report-type-badge"
                :class="`is-${row.typeTone}`"
                :style="{ width: reportTypeBadgeWidth(row.type) }"
              >
                {{ row.type }}
              </span>
              <span class="report-status-cell" :class="`is-${row.status}`">
                <i></i>
                {{ statusLabel(row.status) }}
              </span>
              <span class="report-pass-cell" :class="`is-${passTone(row)}`">
                <i><b :style="{ width: `${row.passRate}%` }"></b></i>
                <strong>{{ row.passRate }}%</strong>
              </span>
              <span class="report-step-stat">
                <em class="is-success">{{ row.steps.success }}✓</em>
                <em v-if="row.steps.failed" class="is-danger">{{ row.steps.failed }}×</em>
                <em v-if="row.steps.skipped" class="is-muted">{{ row.steps.skipped }}—</em>
              </span>
              <span class="report-muted-mono">{{ row.duration }}</span>
              <span class="report-muted-text">{{ row.executor }}</span>
              <span class="report-env-badge" :style="{ width: reportEnvBadgeWidth(row.env) }">{{ row.env }}</span>
              <span class="report-row-actions">
                <button type="button" aria-label="查看报告" @click.stop="selectReport">
                  <img :src="figmaReportIcons.rowAction.view" alt="">
                </button>
                <button type="button" aria-label="分享报告" @click.stop="openSharedReport">
                  <img :src="figmaReportIcons.rowAction.share" alt="">
                </button>
                <button type="button" aria-label="复制报告" @click.stop>
                  <img :src="figmaReportIcons.rowAction.copy" alt="">
                </button>
                <button type="button" aria-label="删除报告" @click.stop>
                  <img :src="figmaReportIcons.rowAction.delete" alt="">
                </button>
              </span>
            </div>
          </div>

          <footer class="report-table-footer">
            <span>共 7 条</span>
            <button type="button">1</button>
          </footer>
        </section>
      </div>

      <div v-else class="report-share-page">
        <div class="report-share-empty">
          <img :src="figmaReportIcons.emptyAi" alt="">
          <span>暂无分享报告</span>
        </div>
      </div>
    </template>

    <template v-else>
      <header class="report-detail-summary">
        <div class="report-detail-summary__toolbar">
          <div class="report-breadcrumb">
            <button type="button" class="report-breadcrumb__back" @click="backToList">
              <img :src="figmaReportIcons.breadcrumbList" alt="">
              <span>报告列表</span>
            </button>
            <img class="report-breadcrumb__separator" :src="figmaReportIcons.breadcrumbChevron" alt="">
            <strong>风控中心-黑名单拦截场景</strong>
          </div>

          <div class="report-actions">
            <button type="button" @click="openSharedReport">
              <img :src="figmaReportIcons.action.share" alt="">
              <span>分享报告</span>
            </button>
            <button type="button">
              <img :src="figmaReportIcons.action.export" alt="">
              <span>导出</span>
            </button>
            <button type="button">
              <img :src="figmaReportIcons.action.rerun" alt="">
              <span>重新执行</span>
            </button>
          </div>
        </div>

        <div class="report-detail-summary__metrics">
          <span class="report-status-pill">
            <i></i>
            失败
          </span>
          <div class="report-pass-rate">
            <strong>50.0%</strong>
            <span>通过率</span>
          </div>
          <i class="report-divider"></i>
          <div class="report-step-counts">
            <span>总步骤 <strong>8</strong></span>
            <span class="is-success">成功 <strong>4</strong></span>
            <span class="is-danger">失败 <strong>3</strong></span>
            <span class="is-muted">跳过 <strong>1</strong></span>
          </div>
          <i class="report-divider"></i>
          <dl class="report-meta-list">
            <div>
              <dt>耗时</dt>
              <dd>48s</dd>
            </div>
            <div>
              <dt>执行环境</dt>
              <dd>预发布</dd>
            </div>
            <div>
              <dt>执行人</dt>
              <dd>李明</dd>
            </div>
            <div>
              <dt>触发方式</dt>
              <dd>CI/CD</dd>
            </div>
            <div>
              <dt>开始</dt>
              <dd>07-03 13:30</dd>
            </div>
          </dl>
        </div>
      </header>

      <div class="report-detail-body">
        <aside class="report-step-sidebar">
          <header>
            <span>步骤 (8)</span>
            <button type="button" :class="{ 'is-active': failOnly }" @click="failOnly = !failOnly">
              <Filter :size="9" :stroke-width="2" />
              {{ failOnly ? `失败 (${failStepCount})` : '全部' }}
            </button>
          </header>

          <div class="report-step-list">
            <button
              v-for="step in visibleReportSteps"
              :key="step.id"
              type="button"
              class="report-step-item"
              :class="[`is-${step.status}`, { 'is-selected': selectedStep?.id === step.id }]"
              @click="selectStep(step)"
            >
              <span class="report-step-status">
                <img :src="figmaReportIcons.status[step.status]" alt="">
              </span>
              <span class="report-step-copy">
                <strong>{{ step.title }}</strong>
                <span v-if="step.method" class="report-step-meta">
                  <em :class="`is-${step.method.toLowerCase()}`">{{ step.method }}</em>
                  <small>{{ step.duration }}</small>
                </span>
                <span v-else class="report-step-meta is-empty">
                  <small>{{ step.duration }}</small>
                </span>
              </span>
              <span class="report-step-open" role="button" tabindex="0" aria-label="展开步骤详情" @click.stop="openStepDrawer(step)">
                <img :src="figmaReportIcons.openDetail" alt="">
              </span>
            </button>
          </div>
        </aside>

        <main class="report-step-canvas">
          <div v-if="selectedStep" class="report-step-selected-layout">
            <article class="report-step-detail-card" :class="`is-${selectedStep.status}`">
              <header>
                <div class="report-step-title-block">
                  <div class="report-step-card__meta">
                    <span>步骤 {{ selectedStep.id }}</span>
                    <i>
                      <img :src="figmaReportIcons.status[selectedStep.status]" alt="">
                    </i>
                    <em>{{ stepStatusLabel(selectedStep.status) }}</em>
                    <small>{{ selectedStep.duration }}</small>
                  </div>
                  <strong>{{ selectedStep.title }}</strong>
                  <div v-if="stepUrl(selectedStep)" class="report-step-url-strip">
                    <em :class="`is-${selectedStep.method?.toLowerCase()}`">{{ selectedStep.method }}</em>
                    <code>{{ stepUrl(selectedStep) }}</code>
                  </div>
                </div>
                <button type="button" class="report-expand-button" @click="openDrawer('request')">
                  <img :src="figmaReportIcons.expandDetail" alt="">
                  展开详情
                </button>
              </header>
            </article>

            <template v-if="selectedStep.status !== 'skipped'">
              <article class="report-section-card">
                <h3>断言结果 ({{ stepAssertionCount(selectedStep.status) }})</h3>
                <div class="report-assertion-list" :class="`is-${selectedStep.status}`">
                  <div v-for="assertion in stepAssertions(selectedStep)" :key="assertion.path" :class="{ 'is-failed': !assertion.pass }">
                    <img :src="figmaReportIcons.status[assertion.pass ? 'success' : 'failed']" alt="">
                    <code>{{ assertion.path }}</code>
                    <span>{{ assertion.op }}</span>
                    <em>{{ assertion.actual }}</em>
                  </div>
                </div>
              </article>

              <article class="report-section-card">
                <h3>响应摘要</h3>
                <div class="report-response-metrics">
                  <div>
                    <span>Status Code</span>
                    <strong :class="`is-${stepStatusCodeTone(selectedStep)}`">{{ stepStatusCode(selectedStep) }}</strong>
                  </div>
                  <div>
                    <span>响应耗时</span>
                    <strong>{{ stepResponseDuration(selectedStep) }}</strong>
                  </div>
                </div>
                <div class="report-code-block">
                  <header>
                    <span>json</span>
                    <button
                      type="button"
                      :class="{ 'is-copied': copiedCodeBlockKey === `selected-${selectedStep.id}-response` }"
                      @click="copyReportCodeBlock(`selected-${selectedStep.id}-response`, stepResponseBody(selectedStep))"
                    >
                      <Check v-if="copiedCodeBlockKey === `selected-${selectedStep.id}-response`" :size="9" :stroke-width="2" />
                      <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                      {{ copiedCodeBlockKey === `selected-${selectedStep.id}-response` ? '已复制' : '复制' }}
                    </button>
                  </header>
                  <pre>{{ stepResponseBody(selectedStep) }}</pre>
                </div>
              </article>

              <article v-if="selectedStep.status === 'success'" class="report-step-pass-card">
                <img :src="figmaReportIcons.status.success" alt="">
                <strong>步骤执行通过</strong>
                <span>点击「展开详情」查看完整请求和响应</span>
              </article>
              <article v-else class="report-section-card is-failed-note">
                <h3>
                  <img :src="figmaReportIcons.status.failed" alt="">
                  错误日志
                </h3>
                <div class="report-code-block is-log">
                  <header>
                    <span>log</span>
                    <button
                      type="button"
                      :class="{ 'is-copied': copiedCodeBlockKey === `selected-${selectedStep.id}-log` }"
                      @click="copyReportCodeBlock(`selected-${selectedStep.id}-log`, stepLog(selectedStep))"
                    >
                      <Check v-if="copiedCodeBlockKey === `selected-${selectedStep.id}-log`" :size="9" :stroke-width="2" />
                      <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                      {{ copiedCodeBlockKey === `selected-${selectedStep.id}-log` ? '已复制' : '复制' }}
                    </button>
                  </header>
                  <pre>{{ stepLog(selectedStep) }}</pre>
                </div>
              </article>

              <article v-if="selectedStep.status === 'failed'" class="report-ai-panel" :class="{ 'is-expanded': detailAiExpanded }">
                <button type="button" class="report-ai-diagnosis" @click="detailAiExpanded = !detailAiExpanded">
                  <Sparkles class="report-ai-panel__icon" :size="13" :stroke-width="2" />
                  <strong>AI 失败诊断</strong>
                  <span>{{ detailAiExpanded ? '收起' : '展开' }}</span>
                  <ChevronDown class="report-ai-panel__chevron" :class="{ 'is-open': detailAiExpanded }" :size="13" :stroke-width="2" />
                </button>
                <div v-if="detailAiExpanded" class="report-ai-panel__body">
                  <section>
                    <h3>诊断结论</h3>
                    <p class="report-ai-panel__summary">{{ reportAiAnalysis.summary }}</p>
                  </section>
                  <section>
                    <h3>分析依据</h3>
                    <div class="report-ai-panel__basis">
                      <div v-for="(item, index) in reportAiAnalysis.basis" :key="item">
                        <span>{{ index + 1 }}</span>
                        <p>{{ item }}</p>
                      </div>
                    </div>
                  </section>
                  <section>
                    <h3>排查建议</h3>
                    <div class="report-ai-panel__suggestions">
                      <div v-for="item in reportAiAnalysis.suggestions" :key="item">
                        <span>→</span>
                        <p>{{ item }}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </article>
            </template>
          </div>

          <div v-else class="report-step-canvas-empty">
            <span class="report-step-canvas-empty__icon">
              <img :src="figmaReportIcons.emptyAi" alt="">
            </span>
            <p>选择左侧步骤查看执行详情</p>
            <button v-if="failStepCount > 0" type="button" @click="failOnly = true">仅查看失败步骤 ({{ failStepCount }})</button>
          </div>
        </main>
      </div>

      <div v-if="drawerVisible && drawerStep" class="report-step-overlay">
        <aside class="report-step-drawer" aria-label="步骤详情">
          <i class="report-step-drawer__accent" :class="`is-${drawerStep.status}`"></i>

          <header class="report-step-drawer__header" :class="{ 'has-url': stepUrl(drawerStep) }">
            <div class="report-step-drawer__title">
              <div>
                <span>步骤 {{ drawerStep.id }}</span>
                <i>
                  <img :src="figmaReportIcons.status[drawerStep.status]" alt="">
                </i>
                <em>{{ stepStatusLabel(drawerStep.status) }}</em>
                <small>{{ drawerStep.duration }}</small>
              </div>
              <strong>{{ drawerStep.title }}</strong>
              <code v-if="stepUrl(drawerStep)">{{ stepUrl(drawerStep) }}</code>
            </div>
            <button type="button" aria-label="关闭步骤详情" @click="closeDrawer">
              <img :src="figmaReportIcons.drawerClose" alt="">
            </button>
          </header>

          <nav class="report-step-drawer__tabs" aria-label="步骤详情 Tab">
            <button type="button" :class="{ 'is-active': activeDrawerTab === 'request' }" @click="activeDrawerTab = 'request'">请求</button>
            <button v-if="drawerStep.status !== 'skipped'" type="button" :class="{ 'is-active': activeDrawerTab === 'response' }" @click="activeDrawerTab = 'response'">响应</button>
            <button type="button" :class="{ 'is-active': activeDrawerTab === 'assertion' }" @click="activeDrawerTab = 'assertion'">断言 ({{ stepAssertionCount(drawerStep.status) }})</button>
            <button type="button" :class="{ 'is-active': activeDrawerTab === 'log' }" @click="activeDrawerTab = 'log'">日志</button>
            <button type="button" :class="{ 'is-active': activeDrawerTab === 'ai' }" @click="activeDrawerTab = 'ai'">AI 分析</button>
          </nav>

          <div class="report-step-drawer__content">
            <template v-if="activeDrawerTab === 'request'">
              <div v-if="stepUrl(drawerStep)" class="report-drawer-section">
                <p class="report-drawer-kicker">请求地址</p>
                <div class="report-drawer-url-box">
                  <em :class="`is-${drawerStep.method?.toLowerCase()}`">{{ drawerStep.method }}</em>
                  <code>{{ stepUrl(drawerStep) }}</code>
                </div>
                <template v-if="stepRequestBody(drawerStep)">
                  <p class="report-drawer-kicker">Request Body</p>
                  <div class="report-code-block is-request-body">
                    <header>
                      <span>json</span>
                      <button
                        type="button"
                        :class="{ 'is-copied': copiedCodeBlockKey === `drawer-${drawerStep.id}-request` }"
                        @click="copyReportCodeBlock(`drawer-${drawerStep.id}-request`, stepRequestBody(drawerStep))"
                      >
                        <Check v-if="copiedCodeBlockKey === `drawer-${drawerStep.id}-request`" :size="9" :stroke-width="2" />
                        <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                        {{ copiedCodeBlockKey === `drawer-${drawerStep.id}-request` ? '已复制' : '复制' }}
                      </button>
                    </header>
                    <pre>{{ stepRequestBody(drawerStep) }}</pre>
                  </div>
                </template>
              </div>
              <div v-else class="report-step-empty">
                <span>该步骤无请求信息</span>
              </div>
            </template>
            <template v-else-if="activeDrawerTab === 'response'">
              <div class="report-drawer-section">
                <div class="report-response-metrics">
                  <div>
                    <span>Status Code</span>
                    <strong :class="`is-${stepStatusCodeTone(drawerStep)}`">{{ stepStatusCode(drawerStep) }}</strong>
                  </div>
                  <div>
                    <span>响应耗时</span>
                    <strong>{{ stepResponseDuration(drawerStep) }}</strong>
                  </div>
                </div>
                <p class="report-drawer-kicker">Response Body</p>
                <div class="report-code-block">
                  <header>
                    <span>json</span>
                    <button
                      type="button"
                      :class="{ 'is-copied': copiedCodeBlockKey === `drawer-${drawerStep.id}-response` }"
                      @click="copyReportCodeBlock(`drawer-${drawerStep.id}-response`, stepResponseBody(drawerStep))"
                    >
                      <Check v-if="copiedCodeBlockKey === `drawer-${drawerStep.id}-response`" :size="9" :stroke-width="2" />
                      <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                      {{ copiedCodeBlockKey === `drawer-${drawerStep.id}-response` ? '已复制' : '复制' }}
                    </button>
                  </header>
                  <pre>{{ stepResponseBody(drawerStep) }}</pre>
                </div>
              </div>
            </template>
            <template v-else-if="activeDrawerTab === 'assertion'">
              <div v-if="drawerStep.status !== 'skipped'" class="report-drawer-assertions">
                <article v-for="assertion in stepAssertions(drawerStep)" :key="assertion.path" :class="{ 'is-failed': !assertion.pass }">
                  <header>
                    <code>{{ assertion.path }}</code>
                    <span>{{ assertion.pass ? '通过' : '失败' }}</span>
                  </header>
                  <dl>
                    <div>
                      <dt>操作符</dt>
                      <dd>{{ assertion.op }}</dd>
                    </div>
                    <div>
                      <dt>期望值</dt>
                      <dd>{{ assertion.expected }}</dd>
                    </div>
                    <div>
                      <dt>实际值</dt>
                      <dd>{{ assertion.actual }}</dd>
                    </div>
                  </dl>
                </article>
              </div>
              <div v-else class="report-step-empty">
                <span>该步骤无断言配置</span>
              </div>
            </template>
            <template v-else-if="activeDrawerTab === 'log'">
              <div v-if="stepLog(drawerStep)" class="report-code-block is-log">
                <header>
                  <span>log</span>
                  <button
                    type="button"
                    :class="{ 'is-copied': copiedCodeBlockKey === `drawer-${drawerStep.id}-log` }"
                    @click="copyReportCodeBlock(`drawer-${drawerStep.id}-log`, stepLog(drawerStep))"
                  >
                    <Check v-if="copiedCodeBlockKey === `drawer-${drawerStep.id}-log`" :size="9" :stroke-width="2" />
                    <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                    {{ copiedCodeBlockKey === `drawer-${drawerStep.id}-log` ? '已复制' : '复制' }}
                  </button>
                </header>
                <pre>{{ stepLog(drawerStep) }}</pre>
              </div>
              <div v-else class="report-step-empty is-log-empty">
                <img :src="figmaReportIcons.status.success" alt="">
                <span>该步骤执行成功，无错误日志</span>
              </div>
            </template>
            <template v-else>
              <div v-if="drawerStep.status === 'failed'" class="report-ai-panel report-drawer-ai-panel" :class="{ 'is-expanded': drawerAiExpanded }">
                <button type="button" class="report-ai-diagnosis" @click="drawerAiExpanded = !drawerAiExpanded">
                  <Sparkles class="report-ai-panel__icon" :size="13" :stroke-width="2" />
                  <strong>AI 失败诊断</strong>
                  <span>{{ drawerAiExpanded ? '收起' : '展开' }}</span>
                  <ChevronDown class="report-ai-panel__chevron" :class="{ 'is-open': drawerAiExpanded }" :size="13" :stroke-width="2" />
                </button>
                <div v-if="drawerAiExpanded" class="report-ai-panel__body">
                  <section>
                    <h3>诊断结论</h3>
                    <p class="report-ai-panel__summary">{{ reportAiAnalysis.summary }}</p>
                  </section>
                  <section>
                    <h3>分析依据</h3>
                    <div class="report-ai-panel__basis">
                      <div v-for="(item, index) in reportAiAnalysis.basis" :key="item">
                        <span>{{ index + 1 }}</span>
                        <p>{{ item }}</p>
                      </div>
                    </div>
                  </section>
                  <section>
                    <h3>排查建议</h3>
                    <div class="report-ai-panel__suggestions">
                      <div v-for="item in reportAiAnalysis.suggestions" :key="item">
                        <span>→</span>
                        <p>{{ item }}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
              <div v-else class="report-step-empty">
                <img :src="figmaReportIcons.emptyAi" alt="">
                <span>仅在步骤失败时提供 AI 分析</span>
              </div>
            </template>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.report-center-page {
  position: relative;
  width: 100%;
  min-width: 1200px;
  height: calc(100dvh - 42px);
  min-height: 820px;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.report-module-tabs {
  display: flex;
  box-sizing: border-box;
  height: 44px;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-module-tabs button {
  height: 43px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-module-tabs button.is-active {
  border-bottom-color: #7816ff;
  color: #7816ff;
}

.report-list-page,
.report-share-page {
  box-sizing: border-box;
  height: calc(100% - 44px);
  padding: 17.5px;
  overflow: hidden;
}

.report-summary-grid {
  display: grid;
  height: 77.75px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10.5px;
}

.report-summary-card {
  position: relative;
  display: flex;
  box-sizing: border-box;
  height: 78.25px;
  flex-direction: column;
  justify-content: center;
  align-self: start;
  padding: 14px 17.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-summary-card strong {
  color: #1d2129;
  font-size: 26px;
  font-weight: 700;
  line-height: 26px;
}

.report-summary-card.is-success strong {
  color: #00b42a;
}

.report-summary-card.is-danger strong {
  color: #f53f3f;
}

.report-summary-card.is-warning strong {
  color: #ff7d00;
}

.report-summary-card span {
  margin-top: 5.25px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-list-toolbar {
  display: flex;
  box-sizing: border-box;
  height: 49.5px;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 17.5px;
}

.report-filter-group,
.report-list-actions {
  display: inline-flex;
  align-items: flex-start;
  gap: 7px;
}

.report-filter-group,
.report-light-button {
  margin-top: 2px;
}

.report-search-field {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  width: 220px;
  height: 28px;
  align-items: center;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.report-search-field img {
  position: absolute;
  top: 6.5px;
  left: 7.75px;
  width: 13px;
  height: 13px;
}

.report-search-field input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 1px 10.5px 1px 28px;
  border: 0;
  outline: none;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 13px;
  line-height: normal;
}

.report-search-field input::placeholder {
  color: #86909c;
}

.report-filter-select {
  width: 120px;
  height: 28px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.report-filter-select + .report-filter-select {
  width: 110px;
}

.report-light-button,
.report-primary-button {
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 10.5px;
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-light-button {
  width: 93.25px;
}

.report-light-button {
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.report-primary-button {
  width: 98.25px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid #165dff;
  background: #165dff;
  color: #ffffff;
}

.report-light-button img,
.report-primary-button img {
  width: 13px;
  height: 13px;
}

.report-table-panel {
  box-sizing: border-box;
  height: 457px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.report-table-canvas {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 412px;
  overflow: hidden;
}

.report-table__header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 34.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.report-table__header span {
  position: absolute;
  top: 8.75px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.275px;
  line-height: 16.5px;
  white-space: nowrap;
}

.report-table__header .is-id {
  left: 14px;
}

.report-table__header .is-name {
  left: 13.960991%;
}

.report-table__header .is-type {
  left: 33.960263%;
}

.report-table__header .is-status {
  left: 42.960177%;
}

.report-table__header .is-pass {
  left: 50.958462%;
}

.report-table__header .is-steps {
  left: 62.958676%;
}

.report-table__header .is-duration {
  left: 73.958333%;
}

.report-table__header .is-executor {
  left: 79.957562%;
}

.report-table__header .is-env {
  left: 85.95679%;
}

.report-table__header .is-start {
  left: 99.100866%;
  transform: translateX(-100%);
  text-align: right;
}

.report-table__row {
  position: absolute;
  left: 0;
  width: 100%;
  border-bottom: 1px solid #e5e6eb;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.report-table__row:hover {
  background: #fafbff;
}

.report-table__row.is-last {
  border-bottom: 0;
}

.report-id {
  position: absolute;
  top: 19.25px;
  left: 14px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-name-cell {
  position: absolute;
  top: 0;
  left: 13.0%;
  width: 20.000643%;
  height: 100%;
}

.report-name-cell strong {
  position: absolute;
  top: 7.5px;
  left: 14px;
  overflow: hidden;
  width: 160px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-name-cell small {
  position: absolute;
  top: 29px;
  left: 14px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-type-badge,
.report-env-badge {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  white-space: nowrap;
}

.report-type-badge {
  position: absolute;
  top: 17.125px;
  left: 33.960263%;
  height: 20px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-type-badge.is-blue {
  background: #e8f3ff;
  color: #165dff;
}

.report-type-badge.is-cyan {
  background: #e8fffb;
  color: #0fc6c2;
}

.report-type-badge.is-purple {
  background: #f5e8ff;
  color: #7816ff;
}

.report-status-cell {
  position: absolute;
  top: 19.1875px;
  left: 42.960177%;
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-status-cell i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
}

.report-status-cell.is-success,
.report-status-cell.is-success i {
  color: #00b42a;
  background: #00b42a;
}

.report-status-cell.is-failed,
.report-status-cell.is-failed i {
  color: #f53f3f;
  background: #f53f3f;
}

.report-status-cell.is-interrupted,
.report-status-cell.is-interrupted i {
  color: #ff7d00;
  background: #ff7d00;
}

.report-status-cell.is-success,
.report-status-cell.is-failed,
.report-status-cell.is-interrupted {
  background: transparent;
}

.report-pass-cell {
  position: absolute;
  top: 18px;
  left: 50.958462%;
  display: inline-flex;
  width: 10.079089%;
  align-items: center;
  gap: 7px;
}

.report-pass-cell i {
  display: block;
  flex: 1 1 auto;
  height: 5.25px;
  overflow: hidden;
  border-radius: 999px;
  background: #f2f3f5;
}

.report-pass-cell b {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.report-pass-cell strong {
  flex: 0 0 35px;
  width: 35px;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-align: right;
}

.report-pass-cell.is-success b {
  background: #00b42a;
}

.report-pass-cell.is-success strong {
  color: #00b42a;
}

.report-pass-cell.is-warning b {
  background: #ff7d00;
}

.report-pass-cell.is-warning strong {
  color: #ff7d00;
}

.report-pass-cell.is-danger b {
  background: #f53f3f;
}

.report-pass-cell.is-danger strong {
  color: #f53f3f;
}

.report-step-stat {
  position: absolute;
  top: 18px;
  left: 62.958676%;
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-step-stat em {
  font-style: normal;
}

.report-step-stat .is-success {
  color: #00b42a;
}

.report-step-stat .is-danger {
  color: #f53f3f;
}

.report-step-stat .is-muted {
  color: #86909c;
}

.report-muted-mono {
  position: absolute;
  top: 17.25px;
  left: 73.958333%;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-muted-text {
  position: absolute;
  top: 17.25px;
  left: 79.957562%;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-env-badge {
  position: absolute;
  top: 19.5px;
  left: 85.95679%;
  height: 15.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-row-actions {
  position: absolute;
  top: 14.75px;
  left: 91.956018%;
  display: inline-flex;
  width: 103.28125px;
  justify-content: flex-end;
  gap: 0;
}

.report-row-actions button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.report-row-actions img {
  width: 13px;
  height: 13px;
}

.report-table-footer {
  display: flex;
  box-sizing: border-box;
  height: 43px;
  align-items: center;
  justify-content: space-between;
  padding: 9.75px 14px 8.75px;
  border-top: 1px solid #e5e6eb;
}

.report-table-footer span {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-table-footer button {
  display: grid;
  width: 24.5px;
  height: 24.5px;
  padding: 1px;
  place-items: center;
  border: 1px solid #165dff;
  border-radius: 5px;
  background: #165dff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-share-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #86909c;
  font-size: 13px;
}

.report-share-empty img {
  width: 24px;
  height: 24px;
}

.report-detail-summary {
  display: flex;
  box-sizing: border-box;
  height: 91.75px;
  flex-direction: column;
  padding: 10.5px 17.5px 11.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-detail-summary__toolbar {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: space-between;
}

.report-breadcrumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.report-breadcrumb__back {
  display: inline-flex;
  height: 18px;
  align-items: center;
  gap: 3.5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-breadcrumb__back img {
  width: 13px;
  height: 13px;
}

.report-breadcrumb__separator {
  width: 12px;
  height: 12px;
}

.report-breadcrumb strong {
  overflow: hidden;
  max-width: 320px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.report-actions button {
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-actions img {
  width: 13px;
  height: 13px;
}

.report-detail-summary__metrics {
  display: flex;
  height: 41.75px;
  align-items: center;
  gap: 17.5px;
  padding-top: 8.75px;
}

.report-status-pill {
  display: inline-flex;
  height: 30.5px;
  align-items: center;
  gap: 7px;
  padding: 5.25px 10.5px;
  border-radius: 7px;
  background: #ffe8e8;
  color: #f53f3f;
  font-size: 13px;
  font-weight: 700;
  line-height: 19.5px;
}

.report-status-pill i {
  width: 8.75px;
  height: 8.75px;
  border-radius: 999px;
  background: #f53f3f;
}

.report-pass-rate {
  display: inline-flex;
  width: 102.515px;
  height: 33px;
  align-items: flex-end;
  gap: 3.5px;
}

.report-pass-rate strong {
  color: #f53f3f;
  font-family: var(--app-font-family-mono);
  font-size: 22px;
  font-weight: 700;
  line-height: 33px;
}

.report-pass-rate span {
  padding-bottom: 4px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-divider {
  width: 1px;
  height: 14px;
  background: #e5e6eb;
}

.report-step-counts {
  display: inline-flex;
  align-items: center;
  gap: 10.5px;
}

.report-step-counts span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-step-counts strong {
  color: #1d2129;
  font-weight: 700;
}

.report-step-counts .is-success,
.report-step-counts .is-success strong {
  color: #00b42a;
}

.report-step-counts .is-danger,
.report-step-counts .is-danger strong {
  color: #f53f3f;
}

.report-step-counts .is-muted,
.report-step-counts .is-muted strong {
  color: #86909c;
}

.report-meta-list {
  display: inline-flex;
  align-items: flex-start;
  gap: 17.5px;
  margin: 0;
}

.report-meta-list div {
  display: flex;
  flex-direction: column;
}

.report-meta-list dt,
.report-meta-list dd {
  margin: 0;
  white-space: nowrap;
}

.report-meta-list dt {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-meta-list dd {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-detail-body {
  display: flex;
  height: calc(100% - 91.75px);
  min-height: 0;
}

.report-step-sidebar {
  display: flex;
  width: 296px;
  flex: 0 0 296px;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-step-sidebar header {
  display: flex;
  box-sizing: border-box;
  height: 41px;
  flex: 0 0 41px;
  align-items: center;
  justify-content: space-between;
  padding: 8.75px 14px 9.75px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-sidebar header span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.1px;
  line-height: 16.5px;
  text-transform: uppercase;
}

.report-step-sidebar header button {
  display: inline-flex;
  height: 22.5px;
  align-items: center;
  gap: 3.5px;
  padding: 2.75px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 3.5px;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-step-sidebar header button.is-active {
  border-color: rgb(245 63 63 / 25%);
  background: rgb(245 63 63 / 7%);
  color: #f53f3f;
}

.report-step-sidebar header img {
  width: 9px;
  height: 9px;
}

.report-step-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.report-step-item {
  display: flex;
  box-sizing: border-box;
  width: 295px;
  height: 55.25px;
  align-items: center;
  gap: 8.75px;
  padding: 8.75px 10.5px 9.75px 13.5px;
  border: 0;
  border-left: 3px solid transparent;
  background: #ffffff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.report-step-item.is-failed {
  border-color: #f53f3f;
  background: rgb(245 63 63 / 2%);
}

.report-step-item.is-skipped {
  height: 53.25px;
  padding-top: 8.75px;
  padding-bottom: 9.75px;
}

.report-step-item.is-selected {
  border-color: #165dff;
  background: rgb(22 93 255 / 3%);
}

.report-step-item:not(.is-selected):not(.is-failed):hover {
  background: #fafbff;
}

.report-step-item.is-failed:not(.is-selected):hover {
  background: rgb(245 63 63 / 8%);
}

.report-step-status {
  display: inline-flex;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.report-step-item.is-success .report-step-status {
  background: #00b42a;
}

.report-step-item.is-failed .report-step-status {
  background: #f53f3f;
}

.report-step-item.is-skipped .report-step-status {
  background: #c9cdd4;
}

.report-step-status img {
  width: 11px;
  height: 11px;
}

.report-step-copy {
  display: flex;
  width: 218.5px;
  min-width: 0;
  flex: 0 0 218.5px;
  flex-direction: column;
}

.report-step-copy > strong {
  overflow: hidden;
  height: 18px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: clip;
  white-space: nowrap;
}

.report-step-item.is-selected .report-step-copy > strong {
  color: #1d2129;
  font-weight: 500;
}

.report-step-meta {
  display: inline-flex;
  height: 18.75px;
  align-items: center;
  gap: 7px;
  padding-top: 1.75px;
}

.report-step-meta em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-step-meta em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-step-meta em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-step-meta em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-step-meta small {
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-step-open {
  display: inline-grid;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  place-items: center;
  border: 0;
  border-radius: 3.5px;
  background: transparent;
  cursor: pointer;
  opacity: 0.5;
}

.report-step-open img {
  width: 10px;
  height: 10px;
}

.report-step-canvas {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 17.5px;
  background: #f4f6fa;
}

.report-step-selected-layout {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: hidden auto;
}

.report-step-detail-card {
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-step-canvas-empty {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 693.25px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.report-step-canvas-empty__icon {
  display: inline-grid;
  width: 42px;
  height: 42px;
  margin-bottom: 10.5px;
  place-items: center;
  border-radius: 11px;
  background: #f2f3f5;
}

.report-step-canvas-empty__icon img {
  width: 22px;
  height: 22px;
}

.report-step-canvas-empty p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-step-canvas-empty button {
  height: 25px;
  padding: 7px 0 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-step-detail-card > header {
  display: flex;
  box-sizing: border-box;
  min-height: 76.5px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 15px;
}

.report-step-title-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.report-step-card__meta,
.report-step-drawer__title > div {
  display: inline-flex;
  height: 18.5px;
  align-items: center;
  gap: 7px;
}

.report-step-card__meta > span,
.report-step-drawer__title span {
  display: inline-flex;
  align-items: center;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-step-card__meta i,
.report-step-drawer__title i {
  display: inline-grid;
  width: 17.5px;
  height: 17.5px;
  place-items: center;
  border-radius: 999px;
  background: #00b42a;
}

.report-step-detail-card.is-failed .report-step-card__meta i,
.report-step-drawer__accent.is-failed + .report-step-drawer__header .report-step-drawer__title i {
  background: #f53f3f;
}

.report-step-detail-card.is-skipped .report-step-card__meta i,
.report-step-drawer__accent.is-skipped + .report-step-drawer__header .report-step-drawer__title i {
  background: #c9cdd4;
}

.report-step-card__meta i img,
.report-step-drawer__title i img {
  width: 11px;
  height: 11px;
}

.report-step-card__meta em,
.report-step-drawer__title em {
  color: #00b42a;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 18px;
}

.report-step-detail-card.is-failed .report-step-card__meta em {
  color: #f53f3f;
}

.report-step-detail-card.is-skipped .report-step-card__meta em {
  color: #ff7d00;
}

.report-step-drawer__accent.is-failed + .report-step-drawer__header .report-step-drawer__title em {
  color: #f53f3f;
}

.report-step-drawer__accent.is-skipped + .report-step-drawer__header .report-step-drawer__title em {
  color: #ff7d00;
}

.report-step-card__meta small,
.report-step-drawer__title small {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-step-title-block > strong {
  margin-top: 7px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.report-step-url-strip {
  display: flex;
  height: 27.5px;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  padding: 5.25px 8.75px;
  border-radius: 5px;
  background: #f7f8fa;
}

.report-step-url-strip em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-step-url-strip em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-step-url-strip em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-step-url-strip em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-step-url-strip code {
  overflow: hidden;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-section-card {
  box-sizing: border-box;
  flex: 0 0 auto;
  padding: 14px 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-section-card h3 {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.report-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10.5px;
}

.report-assertion-list div {
  display: grid;
  box-sizing: border-box;
  min-height: 32px;
  grid-template-columns: 13px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10.5px;
  padding: 7px 10.5px;
  border-radius: 7px;
  background: #f6ffed;
}

.report-assertion-list.is-failed div,
.report-assertion-list div.is-failed {
  background: #fff8f8;
}

.report-assertion-list img {
  width: 13px;
  height: 13px;
}

.report-assertion-list code {
  overflow: hidden;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-assertion-list span {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-assertion-list em {
  color: #00b42a;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.report-assertion-list.is-failed em,
.report-assertion-list div.is-failed em {
  color: #f53f3f;
}

.report-response-metrics {
  display: flex;
  gap: 21px;
  padding-top: 10.5px;
}

.report-response-metrics div {
  display: flex;
  flex-direction: column;
}

.report-response-metrics span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-response-metrics strong {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.report-response-metrics strong.is-success {
  color: #00b42a;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.report-response-metrics strong.is-failed {
  color: #f53f3f;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.report-response-metrics strong.is-muted {
  color: #86909c;
}

.report-code-block {
  margin-top: 10.5px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #13181f;
}

.report-code-block header {
  display: flex;
  box-sizing: border-box;
  height: 25.5px;
  align-items: center;
  justify-content: space-between;
  padding: 5.25px 10.5px;
  background: #1b202b;
}

.report-code-block header span {
  color: #4e6080;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-code-block header button {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #4e6080;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-code-block header button img,
.report-code-block header button svg {
  width: 9px;
  height: 9px;
}

.report-code-block header button.is-copied {
  color: #00b42a;
}

.report-code-block pre {
  box-sizing: border-box;
  height: 177px;
  margin: 0;
  padding: 10.5px;
  overflow: hidden;
  background: #13181f;
  color: #9db5cc;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-code-block.is-request-body pre {
  height: 99px;
}

.report-code-block.is-log pre {
  height: 138px;
}

.report-step-pass-card {
  display: flex;
  box-sizing: border-box;
  min-height: 116.75px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  padding: 21px 22px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-step-pass-card img {
  width: 26px;
  height: 26px;
  margin-bottom: 7px;
}

.report-step-pass-card strong {
  color: #4e5969;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-step-pass-card span {
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-section-card.is-failed-note {
  border-color: rgb(245 63 63 / 30%);
}

.report-section-card.is-failed-note h3 {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  color: #f53f3f;
}

.report-section-card.is-failed-note h3 img {
  width: 13px;
  height: 13px;
}

.report-ai-panel {
  overflow: hidden;
  flex: 0 0 auto;
  border: 1px solid rgb(15 198 194 / 31%);
  border-radius: 11px;
  background: #ffffff;
}

.report-ai-diagnosis {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 41px;
  align-items: center;
  gap: 8.75px;
  padding: 10.5px 14px;
  border: 0;
  background: rgb(15 198 194 / 5%);
  color: #1d2129;
  cursor: pointer;
  font-family: var(--app-font-family);
  text-align: left;
}

.report-ai-diagnosis:hover {
  background: rgb(15 198 194 / 9%);
}

.report-ai-panel__icon {
  flex: 0 0 13px;
  color: #0fc6c2;
}

.report-ai-diagnosis strong {
  flex: 1 1 auto;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: left;
}

.report-ai-diagnosis span,
.report-ai-panel__chevron {
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
}

.report-ai-diagnosis span {
  margin-right: 7px;
}

.report-ai-panel__chevron {
  transition: transform 0.2s ease;
}

.report-ai-panel__chevron.is-open {
  transform: rotate(180deg);
}

.report-ai-panel__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: #fafffe;
}

.report-ai-panel__body section,
.report-ai-panel__body h3,
.report-ai-panel__body p {
  margin: 0;
}

.report-ai-panel__body h3 {
  margin-bottom: 7px;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-ai-panel__summary {
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
}

.report-ai-panel__basis,
.report-ai-panel__suggestions {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
}

.report-ai-panel__basis > div,
.report-ai-panel__suggestions > div {
  display: flex;
  align-items: flex-start;
  gap: 8.75px;
}

.report-ai-panel__basis span {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  margin-top: 1.75px;
  border-radius: 3.5px;
  background: rgb(15 198 194 / 13%);
  color: #0fc6c2;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.report-ai-panel__suggestions span {
  flex: 0 0 auto;
  margin-top: 1.75px;
  color: #ff7d00;
  font-size: 11px;
  line-height: 16.5px;
}

.report-ai-panel__basis p,
.report-ai-panel__suggestions p {
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
}

.report-expand-button {
  display: inline-flex;
  height: 24.5px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-expand-button img {
  width: 11px;
  height: 11px;
}

.report-step-detail-content {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
  padding: 14px;
}

.report-drawer-url-box {
  display: flex;
  box-sizing: border-box;
  width: 665px;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  padding: 8px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #f7f8fa;
}

.report-drawer-url-box em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-drawer-url-box em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-drawer-url-box em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-drawer-url-box em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-drawer-url-box code {
  overflow: hidden;
  flex: 1 1 auto;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-drawer-assertions {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}

.report-drawer-assertions article {
  overflow: hidden;
  border: 1px solid rgb(0 180 42 / 25%);
  border-radius: 11px;
}

.report-drawer-assertions article.is-failed {
  border-color: rgb(245 63 63 / 25%);
}

.report-drawer-assertions header {
  display: flex;
  align-items: center;
  gap: 10.5px;
  padding: 8px 10.5px;
  border-bottom: 1px solid rgb(0 180 42 / 18%);
  background: #f6ffed;
}

.report-drawer-assertions article.is-failed header {
  border-bottom-color: rgb(245 63 63 / 18%);
  background: #fff8f8;
}

.report-drawer-assertions code {
  flex: 1 1 auto;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.report-drawer-assertions header span {
  color: #00b42a;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-drawer-assertions article.is-failed header span {
  color: #f53f3f;
}

.report-drawer-assertions dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 10.5px;
  background: #fafafa;
}

.report-drawer-assertions dt,
.report-drawer-assertions dd {
  margin: 0;
}

.report-drawer-assertions dt {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-drawer-assertions dd {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-drawer-assertions article:not(.is-failed) dd:last-child {
  color: #00b42a;
}

.report-drawer-assertions article.is-failed dd:last-child {
  color: #f53f3f;
}

.report-step-detail-content pre,
.report-log-block {
  margin: 0;
  padding: 12px;
  overflow: hidden;
  border-radius: 5px;
  background: #111827;
  color: #c7d2fe;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 17px;
}

.report-ai-tip,
.report-step-empty-state,
.report-step-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-ai-tip {
  gap: 7px;
  padding: 14px 0;
}

.report-ai-tip img,
.report-step-empty img,
.report-step-empty-state img {
  width: 24px;
  height: 24px;
}

.report-step-empty-state {
  height: 260px;
  flex-direction: column;
  gap: 7px;
}

.report-step-empty-state button {
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
}

.report-step-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  background: rgb(29 33 41 / 45%);
}

.report-step-drawer {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: 700px;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -4px 0 28px rgb(0 0 0 / 14%);
}

.report-step-drawer__accent {
  width: 100%;
  height: 1.75px;
  flex: 0 0 1.75px;
  background: #00b42a;
}

.report-step-drawer__accent.is-failed {
  background: #f53f3f;
}

.report-step-drawer__accent.is-skipped {
  background: #00b42a;
}

.report-step-drawer__header {
  display: flex;
  box-sizing: border-box;
  height: 73.75px;
  flex: 0 0 73.75px;
  align-items: flex-start;
  gap: 10.5px;
  padding: 14px 17.5px 15px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-drawer__header.has-url {
  height: 93.75px;
  flex-basis: 93.75px;
}

.report-step-drawer__title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.report-step-drawer__title > strong {
  margin-top: 5.25px;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 20.625px;
}

.report-step-drawer__title > code {
  overflow: hidden;
  margin-top: 3.5px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-step-drawer__header button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
}

.report-step-drawer__header button img {
  width: 15px;
  height: 15px;
}

.report-step-drawer__tabs {
  display: flex;
  box-sizing: border-box;
  height: 36px;
  flex: 0 0 36px;
  align-items: flex-start;
  padding: 0 17.5px 1px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-drawer__tabs button {
  height: 35px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-step-drawer__tabs button.is-active {
  border-bottom-color: #165dff;
  color: #165dff;
}

.report-step-drawer__content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 17.5px;
  overflow: hidden;
}

.report-drawer-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.report-step-drawer__content .report-response-metrics {
  padding-top: 0;
}

.report-step-drawer__content .report-code-block {
  margin-top: 0;
}

.report-drawer-kicker {
  margin: 0;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-step-empty {
  height: 121px;
  flex-direction: column;
  padding: 35px 0;
}

.report-step-empty.is-log-empty {
  padding-top: 75px;
}

.report-step-empty img {
  margin-bottom: 7px;
}
</style>
