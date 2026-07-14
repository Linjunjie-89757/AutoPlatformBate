<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Sparkles } from '@lucide/vue'
import { useRouter } from 'vue-router'

import { figmaGlobalNavIcons, figmaReportIcons } from '@/shared/assets/figma-icons'

type SharedStepStatus = 'pass' | 'fail' | 'skip'
type SharedMethod = 'GET' | 'POST' | 'DELETE'

interface SharedAssertion {
  path: string
  op: string
  expected: string
  actual: string
  pass: boolean
  message?: string
}

interface SharedStep {
  id: string
  seq: number
  name: string
  status: SharedStepStatus
  duration: string
  method?: SharedMethod
  url?: string
  statusCode?: number
  assertions?: SharedAssertion[]
  errorLog?: string
  responseBody?: string
  aiAnalysis?: {
    summary: string
    basis: string[]
    suggestions: string[]
  }
}

interface ShareNavItem {
  key: string
  icon: string
  active?: boolean
  separated?: boolean
}

const router = useRouter()
const expandedStepId = ref('s4')
const aiExpanded = ref(false)
const shareLinkCopied = ref(false)
const copiedCodeBlockKey = ref('')
let shareLinkResetTimer: ReturnType<typeof window.setTimeout> | null = null
const copiedResetTimers = new Map<string, ReturnType<typeof window.setTimeout>>()

const navItems: ShareNavItem[] = [
  { key: 'dashboard', icon: figmaGlobalNavIcons.dashboard },
  { key: 'case', icon: figmaGlobalNavIcons.case },
  { key: 'config', icon: figmaGlobalNavIcons.config },
  { key: 'bug', icon: figmaGlobalNavIcons.bug },
  { key: 'api', icon: figmaGlobalNavIcons.api },
  { key: 'web', icon: figmaGlobalNavIcons.web },
  { key: 'app', icon: figmaGlobalNavIcons.app },
  { key: 'task', icon: figmaGlobalNavIcons.task },
  { key: 'report', icon: figmaGlobalNavIcons.report, active: true, separated: true },
  { key: 'setting', icon: figmaGlobalNavIcons.setting },
]

const report = {
  name: '风控中心-黑名单拦截场景',
  type: '接口场景',
  trigger: 'CI/CD 触发',
  status: '失败',
  passRate: 50,
  totalSteps: 8,
  passSteps: 4,
  failSteps: 3,
  skipSteps: 1,
  env: '预发布',
  executor: '李明',
  duration: '48s',
  startAt: '2026-07-03 13:30:05',
  endAt: '2026-07-03 13:30:53',
}

const steps: SharedStep[] = [
  {
    id: 's1',
    seq: 1,
    name: 'POST /api/auth/login',
    status: 'pass',
    duration: '120ms',
    method: 'POST',
    url: 'https://staging-api.company.com/api/auth/login',
    statusCode: 200,
    assertions: [
      {
        path: '$.code',
        op: '等于',
        expected: '0',
        actual: '0',
        pass: true,
      },
      {
        path: '$.data.token',
        op: '存在',
        expected: 'eyJhbGci...',
        actual: 'eyJhbGci...',
        pass: true,
      },
    ],
    responseBody: `{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": 10042,
    "role": "user"
  }
}`,
  },
  {
    id: 's2',
    seq: 2,
    name: 'POST /api/risk/blacklist/add',
    status: 'pass',
    duration: '85ms',
    method: 'POST',
    url: 'https://staging-api.company.com/api/risk/blacklist/add',
    statusCode: 200,
  },
  {
    id: 's3',
    seq: 3,
    name: 'GET /api/risk/blacklist/query',
    status: 'pass',
    duration: '67ms',
    method: 'GET',
    url: 'https://staging-api.company.com/api/risk/blacklist/query?userId=99999',
    statusCode: 200,
  },
  {
    id: 's4',
    seq: 4,
    name: 'POST /api/orders/create（黑名单用户下单）',
    status: 'fail',
    duration: '210ms',
    method: 'POST',
    url: 'https://staging-api.company.com/api/orders/create',
    statusCode: 200,
    assertions: [
      {
        path: '$.code',
        op: '等于',
        expected: '403',
        actual: '0',
        pass: false,
        message: '期望返回 403 被拦截，实际返回 0（下单成功）',
      },
      {
        path: '$.message',
        op: '包含',
        expected: 'blacklist',
        actual: 'success',
        pass: false,
        message: '响应消息不含 blacklist 关键字',
      },
    ],
    errorLog: `[2026-07-03 13:30:38.214] [ASSERT FAIL] Step 4: POST /api/orders/create
断言失败: $.code 期望 403，实际 0
断言失败: $.message 期望包含 "blacklist"，实际 "success"

环境: 预发布 (https://staging-api.company.com)
推断: 预发布环境风控中间件未正确拦截黑名单用户下单请求。`,
    responseBody: `{
  "code": 0,
  "message": "success",
  "data": {
    "orderId": "ORD-20260703-99001"
  }
}`,
    aiAnalysis: {
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
    },
  },
  { id: 's5', seq: 5, name: 'POST /api/risk/blacklist/remove', status: 'skip', duration: '—' },
  { id: 's6', seq: 6, name: 'GET /api/risk/blacklist/query（验证移除）', status: 'skip', duration: '—' },
  {
    id: 's7',
    seq: 7,
    name: 'DELETE /api/test/cleanup',
    status: 'fail',
    duration: '315ms',
    method: 'DELETE',
    url: 'https://staging-api.company.com/api/test/cleanup',
    statusCode: 500,
  },
  {
    id: 's8',
    seq: 8,
    name: 'GET /api/orders/list（验证无残留订单）',
    status: 'fail',
    duration: '74ms',
    method: 'GET',
    url: 'https://staging-api.company.com/api/orders/list?userId=99999',
    statusCode: 200,
  },
]

const summaryStats = computed(() => [
  { label: '总步骤', value: report.totalSteps, tone: 'default' },
  { label: '成功', value: report.passSteps, tone: 'success' },
  { label: '失败', value: report.failSteps, tone: 'danger' },
  { label: '跳过', value: report.skipSteps, tone: 'muted' },
])

function toggleStep(stepId: string) {
  expandedStepId.value = expandedStepId.value === stepId ? '' : stepId
}

function stepIcon(step: SharedStep) {
  if (step.status === 'pass') return figmaReportIcons.status.success
  if (step.status === 'fail') return figmaReportIcons.status.failed
  return figmaReportIcons.status.skipped
}

function statusCodeTone(code?: number) {
  if (!code) return 'muted'
  if (code < 300) return 'success'
  if (code < 500) return 'warning'
  return 'danger'
}

function methodTone(method?: SharedMethod) {
  return method?.toLowerCase() ?? 'empty'
}

async function copyCurrentUrl() {
  await copyText(window.location.href)
  shareLinkCopied.value = true

  if (shareLinkResetTimer) window.clearTimeout(shareLinkResetTimer)
  shareLinkResetTimer = window.setTimeout(() => {
    shareLinkCopied.value = false
    shareLinkResetTimer = null
  }, 1500)
}

async function copyCodeBlock(key: string, text = '') {
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
    // Clipboard permission depends on browser context; the button still keeps the Figma action.
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

function enterBackend() {
  void router.push('/reports')
}
</script>

<template>
  <section class="report-share-shell">
    <aside class="report-share-nav" aria-label="主导航">
      <div class="report-share-logo">
        <img :src="figmaReportIcons.sharePage.logo" alt="">
      </div>

      <div class="report-share-nav__list">
        <template v-for="item in navItems" :key="item.key">
          <i v-if="item.separated" class="report-share-nav__divider"></i>
          <button type="button" class="report-share-nav__item" :class="{ 'is-active': item.active }">
            <img :src="item.icon" alt="">
          </button>
        </template>
      </div>

      <div class="report-share-avatar">张</div>
    </aside>

    <main class="report-share-app">
      <header class="report-share-topbar">
        <strong>报告中心</strong>
        <div class="report-share-topbar__right">
          <button type="button" class="report-share-search">
            <img :src="figmaReportIcons.quickSearch" alt="">
            <span>快速查找</span>
            <kbd>⌘K</kbd>
          </button>
          <i></i>
          <span class="report-share-user">
            <em>张</em>
            <span>张程远</span>
            <img :src="figmaReportIcons.userChevron" alt="">
          </span>
        </div>
      </header>

      <div class="report-share-page">
        <header class="report-share-toolbar">
          <div class="report-share-toolbar__inner">
            <div class="report-share-brand">
              <span>
                <img :src="figmaReportIcons.sharePage.logo" alt="">
              </span>
              <strong>AutoTest · 分享报告</strong>
            </div>

            <div class="report-share-actions">
              <button type="button" :class="{ 'is-copied': shareLinkCopied }" @click="copyCurrentUrl">
                <Check v-if="shareLinkCopied" :size="11" :stroke-width="2" />
                <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                <span>{{ shareLinkCopied ? '已复制' : '复制链接' }}</span>
              </button>
              <button type="button">
                <img :src="figmaReportIcons.sharePage.export" alt="">
                <span>导出 PDF</span>
              </button>
              <button type="button" class="is-primary" @click="enterBackend">
                <span>进入后台</span>
              </button>
            </div>
          </div>
        </header>

        <div class="report-share-content">
          <section class="report-share-summary">
            <div class="report-share-summary__head">
              <div class="report-share-title-block">
                <div class="report-share-report-meta">
                  <span>{{ report.type }}</span>
                  <em>{{ report.trigger }}</em>
                </div>
                <h1>{{ report.name }}</h1>
                <div class="report-share-result-line">
                  <span class="report-share-status">
                    <i></i>
                    {{ report.status }}
                  </span>
                  <strong>{{ report.passRate.toFixed(1) }}%</strong>
                  <small>通过率</small>
                </div>
              </div>

              <div class="report-share-stat-list">
                <article v-for="item in summaryStats" :key="item.label" :class="`is-${item.tone}`">
                  <strong>{{ item.value }}</strong>
                  <span>{{ item.label }}</span>
                </article>
              </div>
            </div>

            <dl class="report-share-summary__meta">
              <div>
                <dt>执行环境</dt>
                <dd>{{ report.env }}</dd>
              </div>
              <div>
                <dt>执行人</dt>
                <dd>{{ report.executor }}</dd>
              </div>
              <div>
                <dt>总耗时</dt>
                <dd>{{ report.duration }}</dd>
              </div>
              <div>
                <dt>开始时间</dt>
                <dd>{{ report.startAt }}</dd>
              </div>
              <div>
                <dt>结束时间</dt>
                <dd>{{ report.endAt }}</dd>
              </div>
            </dl>
          </section>

          <section class="report-share-steps">
            <header>
              <strong>步骤执行详情</strong>
              <span>{{ steps.length }} 个步骤 · 点击步骤查看证据</span>
            </header>

            <div class="report-share-step-list">
              <article
                v-for="step in steps"
                :key="step.id"
                class="report-share-step"
                :class="[
                  `is-${step.status}`,
                  {
                    'is-open': expandedStepId === step.id,
                    'is-compact': !step.url && !step.method,
                  },
                ]"
              >
                <button type="button" class="report-share-step__row" @click="toggleStep(step.id)">
                  <span class="report-share-step__dot">
                    <img :src="stepIcon(step)" alt="">
                  </span>
                  <span class="report-share-step__seq">{{ step.seq }}</span>
                  <span class="report-share-step__main">
                    <strong>{{ step.name }}</strong>
                    <code v-if="step.url">{{ step.url }}</code>
                  </span>
                  <em v-if="step.method" class="report-share-method" :class="`is-${methodTone(step.method)}`">{{ step.method }}</em>
                  <em
                    v-if="step.statusCode"
                    class="report-share-code"
                    :class="`is-${statusCodeTone(step.statusCode)}`"
                  >
                    {{ step.statusCode }}
                  </em>
                  <span class="report-share-step__duration">{{ step.duration }}</span>
                  <span class="report-share-step__chevron">
                    <img :src="figmaReportIcons.userChevron" alt="">
                  </span>
                </button>

                <div
                  v-if="expandedStepId === step.id"
                  class="report-share-step__detail"
                  :class="[
                    `is-${step.status}-detail`,
                    { 'is-ai-expanded': Boolean(step.aiAnalysis && aiExpanded) },
                  ]"
                >
                  <div v-if="step.assertions?.length" class="report-share-detail-block">
                    <h3>断言结果</h3>
                    <div class="report-share-assertions">
                      <div v-for="assertion in step.assertions" :key="assertion.path" :class="{ 'is-failed': !assertion.pass }">
                        <span>{{ assertion.pass ? '✓' : '×' }}</span>
                        <code>{{ assertion.path }}</code>
                        <em>{{ assertion.op }}</em>
                        <code>{{ assertion.actual }}</code>
                        <p v-if="assertion.message">{{ assertion.message }}</p>
                      </div>
                    </div>
                  </div>

                  <div v-if="step.errorLog" class="report-share-detail-block">
                    <h3>错误日志</h3>
                    <div class="report-share-codeblock">
                      <div>
                        <span>log</span>
                        <button
                          type="button"
                          :class="{ 'is-copied': copiedCodeBlockKey === `${step.id}-log` }"
                          @click="copyCodeBlock(`${step.id}-log`, step.errorLog)"
                        >
                          <Check v-if="copiedCodeBlockKey === `${step.id}-log`" :size="9" :stroke-width="2" />
                          <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                          {{ copiedCodeBlockKey === `${step.id}-log` ? '已复制' : '复制' }}
                        </button>
                      </div>
                      <pre>{{ step.errorLog }}</pre>
                    </div>
                  </div>

                  <div v-if="step.responseBody" class="report-share-detail-block">
                    <h3>Response Body</h3>
                    <div class="report-share-codeblock">
                      <div>
                        <span>json</span>
                        <button
                          type="button"
                          :class="{ 'is-copied': copiedCodeBlockKey === `${step.id}-response` }"
                          @click="copyCodeBlock(`${step.id}-response`, step.responseBody)"
                        >
                          <Check v-if="copiedCodeBlockKey === `${step.id}-response`" :size="9" :stroke-width="2" />
                          <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                          {{ copiedCodeBlockKey === `${step.id}-response` ? '已复制' : '复制' }}
                        </button>
                      </div>
                      <pre>{{ step.responseBody }}</pre>
                    </div>
                  </div>

                  <div v-if="step.aiAnalysis" class="report-share-ai" :class="{ 'is-expanded': aiExpanded }">
                    <button type="button" @click="aiExpanded = !aiExpanded">
                      <Sparkles class="report-ai-panel__icon" :size="13" :stroke-width="2" />
                      <strong>AI 失败诊断</strong>
                      <em>{{ aiExpanded ? '收起' : '展开' }}</em>
                      <ChevronDown class="report-ai-panel__chevron" :class="{ 'is-open': aiExpanded }" :size="13" :stroke-width="2" />
                    </button>
                    <div v-if="aiExpanded" class="report-ai-panel__body">
                      <section>
                        <h3>诊断结论</h3>
                        <p class="report-ai-panel__summary">{{ step.aiAnalysis.summary }}</p>
                      </section>
                      <section>
                        <h3>分析依据</h3>
                        <div class="report-ai-panel__basis">
                          <div v-for="(item, index) in step.aiAnalysis.basis" :key="item">
                            <span>{{ index + 1 }}</span>
                            <p>{{ item }}</p>
                          </div>
                        </div>
                      </section>
                      <section>
                        <h3>排查建议</h3>
                        <div class="report-ai-panel__suggestions">
                          <div v-for="item in step.aiAnalysis.suggestions" :key="item">
                            <span>→</span>
                            <p>{{ item }}</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <footer class="report-share-footer">由 AutoTest 平台生成 · {{ report.startAt }}</footer>
        </div>
      </div>
    </main>
  </section>
</template>

<style scoped>
.report-share-shell {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.report-share-nav {
  display: flex;
  width: 56px;
  flex: 0 0 56px;
  flex-direction: column;
  align-items: center;
  padding: 10.5px 1px 10.5px 0;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-share-logo {
  display: grid;
  width: 28px;
  height: 28px;
  margin-bottom: 7px;
  place-items: center;
  border-radius: 7px;
  background: linear-gradient(135deg, #165dff 0%, #4f8eff 100%);
}

.report-share-logo img,
.report-share-brand img {
  width: 16px;
  height: 16px;
}

.report-share-nav__list {
  display: flex;
  width: 55px;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  gap: 3.5px;
}

.report-share-nav__item {
  display: grid;
  width: 35px;
  height: 35px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 11px;
  background: transparent;
}

.report-share-nav__item.is-active {
  background: #7816ff;
}

.report-share-nav__item img {
  width: 18px;
  height: 18px;
}

.report-share-nav__divider {
  width: 28px;
  height: 1px;
  margin-bottom: 3.5px;
  background: #e5e6eb;
}

.report-share-avatar,
.report-share-user em {
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #165dff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  font-style: normal;
  line-height: 18px;
}

.report-share-avatar {
  width: 28px;
  height: 28px;
}

.report-share-app {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.report-share-topbar {
  display: flex;
  height: 42px;
  flex: 0 0 42px;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px 1px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-share-topbar strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-share-topbar__right {
  display: flex;
  align-items: center;
  gap: 7px;
}

.report-share-topbar__right > i {
  width: 1px;
  height: 17.5px;
  background: #e5e6eb;
}

.report-share-search {
  display: inline-flex;
  height: 24.5px;
  align-items: center;
  gap: 7px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-share-search img,
.report-share-user img {
  width: 12px;
  height: 12px;
}

.report-share-search kbd {
  padding: 2px 4.5px;
  border: 1px solid #e5e6eb;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-share-user {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-share-user em {
  width: 24.5px;
  height: 24.5px;
}

.report-share-page {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  background: #f4f6fa;
}

.report-share-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-share-toolbar__inner {
  display: flex;
  width: 860px;
  max-width: 100%;
  align-items: center;
  justify-content: space-between;
  margin: 0 auto;
  padding: 10.5px 21px;
}

.report-share-brand {
  display: inline-flex;
  align-items: center;
  gap: 10.5px;
}

.report-share-brand span {
  display: grid;
  width: 24.5px;
  height: 24.5px;
  place-items: center;
  border-radius: 7px;
  background: linear-gradient(135deg, #165dff 0%, #4f8eff 100%);
}

.report-share-brand img {
  width: 14px;
  height: 14px;
}

.report-share-brand strong {
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-share-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.report-share-actions button {
  display: inline-flex;
  box-sizing: border-box;
  height: 24.5px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.report-share-actions button img {
  width: 11px;
  height: 11px;
}

.report-share-actions button svg {
  width: 11px;
  height: 11px;
}

.report-share-actions button:hover {
  border-color: #165dff;
  color: #165dff;
}

.report-share-actions button.is-copied {
  color: #00b42a;
}

.report-share-actions button.is-primary {
  border-color: #165dff;
  background: #165dff;
  color: #ffffff;
}

.report-share-actions button.is-primary:hover {
  filter: brightness(1.1);
}

.report-share-content {
  width: 860px;
  max-width: 100%;
  margin: 0 auto;
  padding: 21px 21px 14px;
}

.report-share-summary,
.report-share-steps {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgb(0 0 0 / 4%);
}

.report-share-summary {
  box-sizing: border-box;
  height: 223px;
  padding: 21px;
}

.report-share-summary__head {
  display: flex;
  height: 113.5px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 21px;
}

.report-share-title-block {
  min-width: 0;
  flex: 1 1 auto;
}

.report-share-report-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}

.report-share-report-meta span {
  display: inline-flex;
  height: 20.5px;
  align-items: center;
  padding: 0 7px;
  border-radius: 3.5px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-share-report-meta em {
  color: #86909c;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.report-share-title-block h1 {
  margin: 0 0 14px;
  color: #1d2129;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.report-share-result-line {
  display: flex;
  align-items: center;
  gap: 10.5px;
}

.report-share-status {
  display: inline-flex;
  height: 37px;
  align-items: center;
  gap: 7px;
  padding: 0 10.5px;
  border-radius: 7px;
  background: #ffe8e8;
  color: #f53f3f;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

.report-share-status i {
  width: 8.75px;
  height: 8.75px;
  border-radius: 999px;
  background: #f53f3f;
}

.report-share-result-line strong {
  color: #f53f3f;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 28px;
  font-weight: 700;
  line-height: 42px;
}

.report-share-result-line small {
  margin-left: 4px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-share-stat-list {
  display: flex;
  flex: 0 0 auto;
  gap: 10.5px;
}

.report-share-stat-list article {
  display: flex;
  box-sizing: border-box;
  min-width: 56px;
  height: 70.75px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10.5px 14px;
  border-radius: 10.5px;
  background: #f7f8fa;
}

.report-share-stat-list strong {
  color: #1d2129;
  font-size: 22px;
  font-weight: 700;
  line-height: 33px;
}

.report-share-stat-list .is-success strong {
  color: #00b42a;
}

.report-share-stat-list .is-danger strong {
  color: #f53f3f;
}

.report-share-stat-list .is-muted strong {
  color: #86909c;
}

.report-share-stat-list span {
  margin-top: 3.5px;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-share-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid #e5e6eb;
}

.report-share-summary__meta dt,
.report-share-summary__meta dd {
  margin: 0;
}

.report-share-summary__meta dt {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-share-summary__meta dd {
  margin-top: 1.75px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-share-steps {
  margin-top: 14px;
  border-radius: 14px;
}

.report-share-steps > header {
  display: flex;
  height: 45.5px;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.report-share-steps > header strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.report-share-steps > header span {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-share-step {
  border-bottom: 1px solid #e5e6eb;
}

.report-share-step:last-child {
  border-bottom: 0;
}

.report-share-step__row {
  display: flex;
  width: 100%;
  height: 59.25px;
  align-items: center;
  gap: 10.5px;
  padding: 10.5px 17.5px;
  border: 0;
  border-left: 3px solid #c9cdd4;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.report-share-step.is-pass .report-share-step__row {
  border-left-color: #00b42a;
}

.report-share-step.is-fail .report-share-step__row {
  border-left-color: #f53f3f;
  background: rgb(245 63 63 / 2%);
}

.report-share-step.is-open .report-share-step__row {
  background: #fafbff;
}

.report-share-step:not(.is-open):not(.is-fail) .report-share-step__row:hover {
  background: #fafbff;
}

.report-share-step.is-fail:not(.is-open) .report-share-step__row:hover {
  background: rgb(245 63 63 / 6%);
}

.report-share-step.is-compact .report-share-step__row {
  height: 41px;
}

.report-share-step__dot {
  display: grid;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  place-items: center;
  border-radius: 999px;
  background: #c9cdd4;
}

.report-share-step.is-pass .report-share-step__dot {
  background: #00b42a;
}

.report-share-step.is-fail .report-share-step__dot {
  background: #f53f3f;
}

.report-share-step__dot img {
  width: 11px;
  height: 11px;
}

.report-share-step__seq {
  width: 17.5px;
  flex: 0 0 17.5px;
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-share-step__main {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.report-share-step__main strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-share-step__main code {
  overflow: hidden;
  margin-top: 1.75px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-share-method,
.report-share-code {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-style: normal;
}

.report-share-method {
  min-width: 44px;
  height: 17px;
  padding: 1px 5.25px;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.report-share-method.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-share-method.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-share-method.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-share-code {
  min-width: 31px;
  height: 20px;
  padding: 1.75px 5.25px;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-share-code.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.report-share-code.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.report-share-step__duration {
  width: 42px;
  flex: 0 0 42px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  text-align: right;
}

.report-share-step__chevron {
  display: grid;
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  place-items: center;
  transition: transform 0.2s ease;
}

.report-share-step__chevron img {
  width: 13px;
  height: 13px;
}

.report-share-step.is-open .report-share-step__chevron {
  transform: rotate(180deg);
}

.report-share-step__detail {
  display: block;
  box-sizing: border-box;
  padding: 10.5px 17.5px 17.5px;
  background: #fafbff;
}

.report-share-step__detail.is-skip-detail {
  height: 28px;
  padding: 0;
}

.report-share-detail-block:nth-child(n + 2) {
  box-sizing: border-box;
  padding-top: 10.5px;
}

.report-share-detail-block h3,
.report-share-ai h3 {
  margin: 0 0 7px;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 15px;
  text-transform: uppercase;
}

.report-share-assertions {
  display: grid;
  gap: 5.25px;
}

.report-share-assertions > div {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 10.5px;
  padding: 7px 10.5px;
  border-radius: 7px;
  background: #f6ffed;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.report-share-assertions > div.is-failed {
  background: #fff8f8;
}

.report-share-assertions span {
  display: grid;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  place-items: center;
  border: 1px solid #f53f3f;
  border-radius: 999px;
  color: #f53f3f;
  font-size: 9px;
  font-weight: 700;
  line-height: 10px;
}

.report-share-assertions > div:not(.is-failed) span {
  border-color: #00b42a;
  color: #00b42a;
}

.report-share-assertions code {
  flex: 0 0 auto;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
}

.report-share-assertions code:first-of-type {
  flex: 1 1 auto;
}

.report-share-assertions > div:not(.is-failed) code:last-of-type {
  color: #00b42a;
}

.report-share-assertions > div.is-failed code:last-of-type {
  color: #f53f3f;
}

.report-share-assertions em {
  flex: 0 0 auto;
  color: #86909c;
  font-style: normal;
}

.report-share-assertions p {
  flex: 0 0 auto;
  margin: 0;
  color: #f53f3f;
}

.report-share-codeblock {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #13181f;
}

.report-share-codeblock > div {
  display: flex;
  height: 25.5px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10.5px;
  background: #1b202b;
}

.report-share-codeblock span,
.report-share-codeblock button {
  color: #4e6080;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-share-codeblock button {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.report-share-codeblock button img {
  width: 9px;
  height: 9px;
}

.report-share-codeblock button svg {
  width: 9px;
  height: 9px;
}

.report-share-codeblock button.is-copied {
  color: #00b42a;
}

.report-share-codeblock pre {
  box-sizing: border-box;
  margin: 0;
  overflow: visible;
  padding: 10.5px;
  color: #9db5cc;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
}

.report-share-ai {
  overflow: hidden;
  margin-top: 10.5px;
  border: 1px solid rgb(15 198 194 / 31%);
  border-radius: 10.5px;
  background: #ffffff;
}

.report-share-ai > button {
  display: flex;
  width: 100%;
  min-height: 41px;
  align-items: center;
  gap: 8.75px;
  padding: 10.5px 14px;
  border: 0;
  background: rgb(15 198 194 / 5%);
  text-align: left;
  cursor: pointer;
}

.report-share-ai > button:hover {
  background: rgb(15 198 194 / 9%);
}

.report-ai-panel__icon {
  flex: 0 0 13px;
  color: #0fc6c2;
}

.report-share-ai > button strong {
  flex: 1 1 auto;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.report-share-ai > button em {
  margin-right: 7px;
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  line-height: 16.5px;
}

.report-ai-panel__chevron {
  color: #86909c;
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

.report-share-footer {
  display: flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

@media (max-width: 980px) {
  .report-share-toolbar__inner,
  .report-share-content {
    width: 100%;
  }

  .report-share-summary__head {
    flex-direction: column;
  }

  .report-share-stat-list {
    width: 100%;
  }

  .report-share-stat-list article {
    flex: 1 1 0;
  }
}
</style>
