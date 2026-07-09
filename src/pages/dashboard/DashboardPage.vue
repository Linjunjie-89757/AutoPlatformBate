<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bug,
  CheckCircle,
  ChevronRight,
  FileText,
  Link2,
  Monitor,
  Play,
  Server,
  Sparkles,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useSession } from '@/entities/session'

const palette = {
  primary: '#165DFF',
  success: '#00B42A',
  warning: '#FF7D00',
  danger: '#F53F3F',
  purple: '#7816FF',
  cyan: '#0FC6C2',
  border: '#E5E6EB',
  bg: '#F4F6FA',
  text1: '#1D2129',
  text2: '#4E5969',
  text3: '#86909C',
  text4: '#C9CDD4',
}

type TaskStatus = 'passed' | 'failed' | 'running' | 'aborted'
type TaskType = 'api' | 'webui'
type TriggerType = 'cron' | 'manual'
type AttentionKind = 'failed-task' | 'pending-ai' | 'p0-bug'

interface RecentTask {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  time: string
  duration: string | null
  trigger: TriggerType
}

interface AttentionItem {
  id: string
  kind: AttentionKind
  title: string
  desc: string
  time: string
  actionLabel: string
  actionColor: string
}

interface SystemItem {
  label: string
  ok: boolean
  detail: string
  icon: LucideIcon
}

interface UpcomingTask {
  name: string
  time: string
  type: string
  done: boolean
}

const router = useRouter()
const { currentUser } = useSession()

const userName = computed(() => currentUser.value?.displayName || currentUser.value?.username || '张程远')
const roleName = computed(() => currentUser.value?.roleCode || '测试负责人')

const stats = [
  { label: '今日执行', value: '236', sub: '次', color: palette.primary, trend: false },
  { label: '通过率', value: '93.6', sub: '%', color: palette.success, trend: true },
  { label: '进行中', value: '2', sub: '个任务', color: '#F59E0B', trend: false },
  { label: '待处理缺陷', value: '8', sub: 'P0×2', color: palette.danger, trend: false },
  { label: 'AI待审', value: '28', sub: '条用例', color: palette.purple, trend: false },
]

const quickActions = [
  { label: '执行任务', icon: Play, color: palette.primary, path: '/automation/api/execution-suites' },
  { label: '新建用例', icon: FileText, color: palette.success, path: '/cases/manage' },
  { label: 'AI 生成', icon: Sparkles, color: palette.purple, path: '/cases/ai-generate' },
  { label: '查看报告', icon: Activity, color: palette.purple, path: '/automation/api/reports' },
]

const recentTasks: RecentTask[] = [
  { id: 'T005', name: '支付回调接口-烟雾测试', type: 'api', status: 'running', time: '10:30', duration: null, trigger: 'cron' },
  { id: 'T001', name: '订单接口回归-全量', type: 'api', status: 'passed', time: '02:00', duration: '4m 32s', trigger: 'cron' },
  { id: 'T002', name: '风控中心-黑名单场景验证', type: 'api', status: 'failed', time: '01:00', duration: '1m 18s', trigger: 'cron' },
  { id: 'T003', name: '用户中心-登录注册 Web UI 回归', type: 'webui', status: 'passed', time: '昨天 23:01', duration: '8m 55s', trigger: 'cron' },
  { id: 'T007', name: '系统并发压测套件', type: 'api', status: 'failed', time: '昨天 16:00', duration: '12m 40s', trigger: 'manual' },
  { id: 'T004', name: '获客中心-产品管理 UI 用例', type: 'webui', status: 'aborted', time: '昨天 14:30', duration: '3m 02s', trigger: 'manual' },
]

const attentionItems: AttentionItem[] = [
  { id: 'a1', kind: 'failed-task', title: '风控接口场景连续失败 2 次', desc: 'T002 · 超时 1018ms，疑似测试环境问题', time: '01:00', actionLabel: '查看报告', actionColor: palette.danger },
  { id: 'a2', kind: 'pending-ai', title: '28 条 AI 生成用例待评审', desc: 'TSK_T3O04 · 退款超时校验流程', time: '昨天', actionLabel: '去评审', actionColor: palette.purple },
  { id: 'a3', kind: 'p0-bug', title: 'BUG-038 · 登录白屏复现率 100%', desc: 'P0 · 风控中心 · 指派李明 · 已超 24h 未处理', time: '2 天前', actionLabel: '跟进', actionColor: palette.danger },
  { id: 'a4', kind: 'failed-task', title: '并发压测套件失败', desc: 'T007 · 12m 40s 中止，返回 503', time: '昨天 16:00', actionLabel: '查看日志', actionColor: palette.warning },
]

const systemItems: SystemItem[] = [
  { label: 'Runner 节点', ok: true, detail: '2 在线 · 1 忙碌 · 1 离线', icon: Server },
  { label: 'AI 连接池', ok: false, detail: '2 正常 · 1 异常（Key 未配置）', icon: Sparkles },
  { label: '通知渠道', ok: true, detail: 'QA 机器人正常 · 邮件已停用', icon: Bell },
  { label: '接口自动化', ok: true, detail: '4 个场景 · 3 个套件就绪', icon: Link2 },
  { label: 'Web UI 自动化', ok: true, detail: 'Chrome / Edge 驱动正常', icon: Monitor },
]

const upcomingTasks: UpcomingTask[] = [
  { name: '每日测试报告推送', time: '今天 09:00', type: '通知', done: true },
  { name: '订单接口回归-全量', time: '明天 02:00', type: '接口套件', done: false },
  { name: '登录注册 Web UI 回归', time: '周五 23:00', type: 'Web UI 套件', done: false },
]

const moduleQuality = [
  { name: '订单中心', pass: 97, color: palette.success },
  { name: '风控中心', pass: 68, color: palette.warning },
  { name: '用户中心', pass: 91, color: palette.success },
  { name: '获客中心', pass: 100, color: palette.success },
]

const aiInsights = [
  { title: '质量摘要', body: '近 7 天通过率 93.6%，较上周 ↑2.1%。失败集中在风控中心（5次）和订单中心（3次）。' },
  { title: '根因分析', body: '/api/v1/blacklist 接口超时率偏高，建议检查服务响应延迟，考虑增加重试断言。' },
]

const allSystemsOk = computed(() => systemItems.every(item => item.ok))

function getStatusText(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    running: '执行中...',
    passed: '通过',
    failed: '失败',
    aborted: '已中止',
  }
  return map[status]
}

function getStatusColor(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    running: palette.primary,
    passed: palette.success,
    failed: palette.danger,
    aborted: palette.text4,
  }
  return map[status]
}

function getAttentionIcon(kind: AttentionKind) {
  const map: Record<AttentionKind, LucideIcon> = {
    'failed-task': XCircle,
    'pending-ai': Sparkles,
    'p0-bug': Bug,
  }
  return map[kind]
}

function getAttentionBg(kind: AttentionKind) {
  return kind === 'pending-ai' ? '#F5E8FF' : '#FFE8E8'
}

function getAttentionColor(kind: AttentionKind) {
  return kind === 'pending-ai' ? palette.purple : palette.danger
}

function navigateTo(path: string) {
  void router.push(path)
}
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-page__hero" aria-label="工作台概览">
      <div class="dashboard-page__greeting">
        <span class="dashboard-page__eyebrow">工作台 · X-MAN · 2026-07-07</span>
        <strong>早上好，{{ userName }}</strong>
        <span>{{ roleName }}</span>
      </div>

      <span class="dashboard-page__divider" />

      <div class="dashboard-page__stats" aria-label="关键指标">
        <span
          v-for="stat in stats"
          :key="stat.label"
          class="dashboard-page__stat"
        >
          <strong :style="{ color: stat.color }">{{ stat.value }}</strong>
          <small>{{ stat.sub }}</small>
          <span>{{ stat.label }}</span>
          <TrendingUp v-if="stat.trend" class="dashboard-page__trend-icon" />
        </span>
      </div>

      <div class="dashboard-page__quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="dashboard-page__quick-action"
          type="button"
          :style="{ '--action-color': action.color }"
          @click="navigateTo(action.path)"
        >
          <component :is="action.icon" />
          <span>{{ action.label }}</span>
        </button>
      </div>
    </section>

    <section class="dashboard-page__content">
      <section class="dashboard-panel dashboard-panel--timeline">
        <header class="dashboard-panel__header">
          <span class="dashboard-panel__title">今日执行动态</span>
          <span class="dashboard-page__pill dashboard-page__pill--blue">最近 6 条</span>
          <button class="dashboard-page__text-button" type="button" @click="navigateTo('/automation/api/execution-suites')">
            全部
            <ChevronRight />
          </button>
        </header>

        <div class="dashboard-timeline">
          <button
            v-for="(task, index) in recentTasks"
            :key="task.id"
            class="dashboard-timeline__item"
            type="button"
            :class="{ 'is-last': index === recentTasks.length - 1 }"
          >
            <span
              v-if="task.status === 'running'"
              class="dashboard-timeline__running-dot"
              aria-hidden="true"
            />
            <CheckCircle
              v-else-if="task.status === 'passed'"
              class="dashboard-timeline__status-icon"
              :style="{ color: palette.success }"
            />
            <XCircle
              v-else-if="task.status === 'failed'"
              class="dashboard-timeline__status-icon"
              :style="{ color: palette.danger }"
            />
            <span v-else class="dashboard-timeline__aborted-dot" aria-hidden="true" />

            <span class="dashboard-timeline__body">
              <span class="dashboard-timeline__title-row">
                <strong>{{ task.name }}</strong>
                <span
                  class="dashboard-page__tag"
                  :class="task.type === 'webui' ? 'is-webui' : 'is-api'"
                >
                  {{ task.type === 'webui' ? 'UI' : '接口' }}
                </span>
                <span
                  class="dashboard-page__tag"
                  :class="task.trigger === 'cron' ? 'is-cron' : 'is-manual'"
                >
                  {{ task.trigger === 'cron' ? '定时' : '手动' }}
                </span>
              </span>
              <span class="dashboard-timeline__meta">
                <span :style="{ color: getStatusColor(task.status) }">{{ getStatusText(task.status) }}</span>
                <span v-if="task.duration" class="dashboard-page__mono">{{ task.duration }}</span>
              </span>
            </span>

            <span class="dashboard-timeline__time">{{ task.time }}</span>
            <ArrowUpRight class="dashboard-timeline__open-icon" />
          </button>
        </div>

        <footer class="dashboard-panel__footer">
          <span>今日共</span>
          <strong>236 次</strong>
          <span class="dashboard-panel__footer-divider" />
          <span class="is-success">221 通过</span>
          <span class="is-danger">15 失败</span>
          <span class="is-warning">2 进行中</span>
        </footer>
      </section>

      <section class="dashboard-page__middle">
        <section class="dashboard-panel dashboard-panel--attention">
          <header class="dashboard-panel__header">
            <AlertTriangle class="dashboard-panel__header-icon" />
            <span class="dashboard-panel__title">需要关注</span>
            <span class="dashboard-page__pill dashboard-page__pill--red">{{ attentionItems.length }}</span>
          </header>

          <div class="dashboard-attention-list">
            <article
              v-for="item in attentionItems"
              :key="item.id"
              class="dashboard-attention-card"
            >
              <span
                class="dashboard-attention-card__icon"
                :style="{ color: getAttentionColor(item.kind), background: getAttentionBg(item.kind) }"
              >
                <component :is="getAttentionIcon(item.kind)" />
              </span>
              <span class="dashboard-attention-card__body">
                <strong>{{ item.title }}</strong>
                <small>{{ item.desc }}</small>
              </span>
              <span class="dashboard-attention-card__action">
                <small>{{ item.time }}</small>
                <button
                  type="button"
                  :style="{ color: item.actionColor, borderColor: `${item.actionColor}30`, background: `${item.actionColor}18` }"
                >
                  {{ item.actionLabel }}
                </button>
              </span>
            </article>
          </div>
        </section>

        <section class="dashboard-panel dashboard-panel--quality">
          <header class="dashboard-quality__header">
            <span class="dashboard-panel__title">模块质量</span>
            <small>近 7 天</small>
          </header>

          <div class="dashboard-quality__grid">
            <div
              v-for="item in moduleQuality"
              :key="item.name"
              class="dashboard-quality__item"
            >
              <span>
                <small>{{ item.name }}</small>
                <strong :style="{ color: item.color }">{{ item.pass }}%</strong>
              </span>
              <span class="dashboard-quality__bar">
                <span :style="{ width: `${item.pass}%`, background: item.color }" />
              </span>
            </div>
          </div>
        </section>
      </section>

      <aside class="dashboard-page__right">
        <section class="dashboard-panel dashboard-panel--health">
          <header class="dashboard-quality__header">
            <span class="dashboard-panel__title">系统健康</span>
            <small :class="allSystemsOk ? 'is-success' : 'is-warning'">
              <span />
              {{ allSystemsOk ? '全部正常' : '部分异常' }}
            </small>
          </header>

          <div class="dashboard-health-list">
            <article
              v-for="item in systemItems"
              :key="item.label"
              class="dashboard-health-item"
            >
              <span
                class="dashboard-health-item__icon"
                :class="item.ok ? 'is-ok' : 'is-error'"
              >
                <component :is="item.icon" />
              </span>
              <span class="dashboard-health-item__body">
                <span>
                  <strong>{{ item.label }}</strong>
                  <small :class="item.ok ? 'is-success' : 'is-danger'">{{ item.ok ? '正常' : '异常' }}</small>
                </span>
                <em>{{ item.detail }}</em>
              </span>
            </article>
          </div>
        </section>

        <section class="dashboard-panel dashboard-panel--upcoming">
          <header class="dashboard-quality__header">
            <span class="dashboard-panel__title">即将执行</span>
            <button class="dashboard-page__text-button" type="button" @click="navigateTo('/automation/api/execution-suites')">
              全部
              <ChevronRight />
            </button>
          </header>

          <div class="dashboard-upcoming-list">
            <article
              v-for="item in upcomingTasks"
              :key="item.name"
              class="dashboard-upcoming-item"
              :class="{ 'is-done': item.done }"
            >
              <span class="dashboard-upcoming-item__dot" />
              <span class="dashboard-upcoming-item__body">
                <strong>{{ item.name }}</strong>
                <small>
                  <span>{{ item.time }}</span>
                  <em>{{ item.type }}</em>
                  <span v-if="item.done">已完成</span>
                </small>
              </span>
            </article>
          </div>
        </section>

        <section class="dashboard-panel dashboard-panel--ai">
          <header class="dashboard-panel__ai-header">
            <Sparkles />
            <span class="dashboard-panel__title">AI 洞察</span>
          </header>

          <div class="dashboard-ai-list">
            <article
              v-for="item in aiInsights"
              :key="item.title"
              class="dashboard-ai-card"
            >
              <strong>{{ item.title }}</strong>
              <p>{{ item.body }}</p>
            </article>
          </div>

          <button class="dashboard-ai-action" type="button">查看完整 AI 分析</button>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: calc(100dvh - 72px);
  min-height: 720px;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.dashboard-page__hero {
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 64px;
  padding: 12px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1d2129 0%, #2d3748 100%);
  color: #fff;
  overflow: hidden;
}

.dashboard-page__greeting {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  flex: 0 0 auto;
  min-width: 204px;
  column-gap: 0;
  row-gap: 2px;
}

.dashboard-page__greeting strong {
  font-size: 17px;
  font-weight: 500;
  line-height: 25.5px;
}

.dashboard-page__greeting span:last-child {
  margin-left: 7px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-weight: 400;
}

.dashboard-page__eyebrow {
  flex: 0 0 100%;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  line-height: 15px;
}

.dashboard-page__divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.15);
}

.dashboard-page__stats {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.dashboard-page__stat {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-width: max-content;
}

.dashboard-page__stat strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 22px;
}

.dashboard-page__stat small {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  line-height: 17px;
}

.dashboard-page__stat span {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  line-height: 15px;
}

.dashboard-page__trend-icon {
  width: 11px;
  height: 11px;
  color: #00b42a;
}

.dashboard-page__quick-actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
}

.dashboard-page__quick-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.dashboard-page__quick-action:hover {
  border-color: color-mix(in srgb, var(--action-color) 60%, rgba(255, 255, 255, 0.18));
  background: color-mix(in srgb, var(--action-color) 50%, rgba(255, 255, 255, 0.1));
}

.dashboard-page__quick-action svg {
  width: 11px;
  height: 11px;
}

.dashboard-page__content {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr) 256px;
  gap: 12px;
  min-height: 0;
  flex: 1 1 auto;
}

.dashboard-panel {
  min-width: 0;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.dashboard-panel--timeline,
.dashboard-panel--attention {
  display: flex;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

.dashboard-panel--attention {
  flex: 1 1 auto;
}

.dashboard-panel__header {
  display: flex;
  align-items: center;
  min-height: 47px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid #e5e6eb;
  gap: 8px;
}

.dashboard-panel__title {
  color: #1d2129;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
}

.dashboard-panel__header-icon {
  width: 14px;
  height: 14px;
  color: #ff7d00;
}

.dashboard-page__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 19px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 17px;
}

.dashboard-page__pill--blue {
  background: #e8f3ff;
  color: #165dff;
}

.dashboard-page__pill--red {
  background: #ffe8e8;
  color: #f53f3f;
  font-weight: 600;
}

.dashboard-page__text-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.dashboard-page__text-button svg {
  width: 12px;
  height: 12px;
}

.dashboard-timeline {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 18px;
}

.dashboard-timeline__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 60px;
  gap: 12px;
  padding: 11px 0;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.dashboard-timeline__item.is-last {
  border-bottom: 0;
}

.dashboard-timeline__running-dot,
.dashboard-timeline__aborted-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dashboard-timeline__running-dot {
  background: #165dff;
  animation: dashboard-pulse 1.2s ease-in-out infinite;
}

.dashboard-timeline__aborted-dot {
  background: #c9cdd4;
}

.dashboard-timeline__status-icon {
  width: 13px;
  height: 13px;
}

.dashboard-timeline__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 1px;
}

.dashboard-timeline__title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.dashboard-timeline__title-row strong {
  overflow: hidden;
  min-width: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-page__tag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 17px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 15px;
}

.dashboard-page__tag.is-api {
  background: #fff3e8;
  color: #ff7d00;
}

.dashboard-page__tag.is-webui {
  background: #e0fffe;
  color: #0fc6c2;
}

.dashboard-page__tag.is-cron {
  background: #f5f0ff;
  color: #7816ff;
}

.dashboard-page__tag.is-manual {
  background: #f2f3f5;
  color: #86909c;
}

.dashboard-timeline__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #86909c;
  font-size: 11px;
  line-height: 17px;
}

.dashboard-page__mono,
.dashboard-timeline__time {
  font-family: var(--app-font-family-mono);
}

.dashboard-timeline__time {
  flex: 0 0 auto;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 17px;
}

.dashboard-timeline__open-icon {
  width: 13px;
  height: 13px;
  color: #165dff;
  opacity: 0;
  transition: opacity 160ms ease;
}

.dashboard-timeline__item:hover .dashboard-timeline__open-icon {
  opacity: 1;
}

.dashboard-panel__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 14px;
  min-height: 40px;
  padding: 10px 18px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.dashboard-panel__footer strong {
  color: #165dff;
  font-weight: 500;
}

.dashboard-panel__footer-divider {
  width: 1px;
  height: 12px;
  background: #e5e6eb;
}

.dashboard-panel__footer .is-success {
  color: #00b42a;
}

.dashboard-panel__footer .is-danger {
  color: #f53f3f;
}

.dashboard-panel__footer .is-warning {
  color: #f59e0b;
}

.dashboard-page__middle {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: 12px;
}

.dashboard-attention-list {
  display: flex;
  overflow-y: auto;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 12px 14px;
}

.dashboard-attention-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fafafa;
}

.dashboard-attention-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.dashboard-attention-card__icon svg {
  width: 13px;
  height: 13px;
}

.dashboard-attention-card__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 3px;
}

.dashboard-attention-card__body strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-attention-card__body small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-attention-card__action {
  display: grid;
  flex: 0 0 auto;
  justify-items: end;
  gap: 4px;
}

.dashboard-attention-card__action small {
  color: #c9cdd4;
  font-size: 10px;
  line-height: 15px;
}

.dashboard-attention-card__action button {
  height: 21px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 6px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
}

.dashboard-panel--quality {
  flex: 0 0 auto;
  padding: 15px 18px 16px;
}

.dashboard-quality__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.dashboard-quality__header small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  line-height: 17px;
}

.dashboard-quality__header small span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.dashboard-quality__header small.is-success {
  color: #00b42a;
}

.dashboard-quality__header small.is-warning {
  color: #ff7d00;
}

.dashboard-quality__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 21px;
}

.dashboard-quality__item {
  display: grid;
  gap: 4px;
}

.dashboard-quality__item span:first-child {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-quality__item small {
  color: #4e5969;
  font-size: 11px;
  line-height: 17px;
}

.dashboard-quality__item strong {
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
}

.dashboard-quality__bar {
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: #f2f3f5;
}

.dashboard-quality__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.dashboard-page__right {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: 12px;
}

.dashboard-panel--health,
.dashboard-panel--upcoming {
  flex: 0 0 auto;
  padding: 15px;
}

.dashboard-health-list {
  display: grid;
  gap: 10px;
}

.dashboard-health-item {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.dashboard-health-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 5px;
}

.dashboard-health-item__icon.is-ok {
  background: #e8ffea;
  color: #00b42a;
}

.dashboard-health-item__icon.is-error {
  background: #ffe8e8;
  color: #f53f3f;
}

.dashboard-health-item__icon svg {
  width: 11px;
  height: 11px;
}

.dashboard-health-item__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
}

.dashboard-health-item__body span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}

.dashboard-health-item__body strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 11px;
  font-weight: 400;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-health-item__body small {
  flex: 0 0 auto;
  font-size: 9px;
  line-height: 14px;
}

.dashboard-health-item__body small.is-success {
  color: #00b42a;
}

.dashboard-health-item__body small.is-danger {
  color: #f53f3f;
}

.dashboard-health-item__body em {
  overflow: hidden;
  color: #86909c;
  font-size: 10px;
  font-style: normal;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-upcoming-list {
  display: grid;
  gap: 10px;
}

.dashboard-upcoming-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-upcoming-item.is-done {
  opacity: 0.58;
}

.dashboard-upcoming-item__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #165dff;
}

.dashboard-upcoming-item.is-done .dashboard-upcoming-item__dot {
  background: #c9cdd4;
}

.dashboard-upcoming-item__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 2px;
}

.dashboard-upcoming-item__body strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 11px;
  font-weight: 400;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-upcoming-item__body small {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #165dff;
  font-size: 10px;
  line-height: 15px;
}

.dashboard-upcoming-item__body em {
  padding: 1px 4px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-style: normal;
}

.dashboard-panel--ai {
  display: flex;
  overflow: hidden;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  padding: 15px;
  border-color: #d8b4fe;
  background: linear-gradient(160deg, #fafaff, #f5f0ff);
  box-shadow: none;
}

.dashboard-panel__ai-header {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  margin-bottom: 12px;
}

.dashboard-panel__ai-header svg {
  width: 13px;
  height: 13px;
  color: #7816ff;
}

.dashboard-ai-list {
  display: grid;
  overflow-y: auto;
  flex: 1 1 auto;
  gap: 8px;
  min-height: 0;
}

.dashboard-ai-card {
  padding: 12px;
  border: 1px solid #e9d5ff;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
}

.dashboard-ai-card strong {
  color: #7816ff;
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
}

.dashboard-ai-card p {
  margin: 4px 0 0;
  color: #4e5969;
  font-size: 11px;
  line-height: 18px;
}

.dashboard-ai-action {
  flex: 0 0 auto;
  height: 28px;
  margin-top: 10px;
  border: 1px solid #d8b4fe;
  border-radius: 8px;
  background: #f5e8ff;
  color: #7816ff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
}

@keyframes dashboard-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (max-width: 1280px) {
  .dashboard-page {
    height: auto;
    min-height: calc(100dvh - 72px);
    overflow: visible;
  }

  .dashboard-page__hero {
    flex-wrap: wrap;
  }

  .dashboard-page__stats {
    order: 3;
    width: 100%;
    flex-basis: 100%;
    flex-wrap: wrap;
  }

  .dashboard-page__content {
    grid-template-columns: minmax(0, 1fr);
  }

  .dashboard-page__right {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dashboard-page__hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-page__divider {
    display: none;
  }

  .dashboard-page__quick-actions,
  .dashboard-page__stats,
  .dashboard-page__right,
  .dashboard-quality__grid {
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
  }

  .dashboard-page__quick-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-timeline__time,
  .dashboard-timeline__open-icon {
    display: none;
  }
}
</style>
