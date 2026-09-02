<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { AiGenerationTaskEventItem, AiGenerationTaskItem, GeneratedAiCaseItem } from '@/entities/case-ai'

type ConsoleTone = 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'muted' | 'white'

interface ConsoleLine {
  key: string
  text: string
  tone: ConsoleTone
  indent?: boolean
  cursor?: boolean
}

interface ReviewPayload {
  status?: string
  summary?: string
  coverageComment?: string
  evidenceComment?: string
  reviewComment?: string
  optimizationReason?: string
  coverageGap?: string
  supplementReason?: string
}

const props = withDefaults(defineProps<{
  record?: AiGenerationTaskItem | null
  loading?: boolean
  title?: string
}>(), {
  record: null,
  loading: false,
  title: 'ai_case_generation.log',
})

const logBodyRef = ref<HTMLElement | null>(null)
const autoFollow = ref(true)
const clockTick = ref(Date.now())

let clockTimer: number | null = null

const runningStatuses = ['PENDING', 'GENERATING', 'REVIEWING']
const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELED']

const sortedEvents = computed(() => [...(props.record?.events ?? [])].sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0)))
const isRunning = computed(() => Boolean(props.record && runningStatuses.includes(props.record.status)))
const isTerminal = computed(() => Boolean(props.record && terminalStatuses.includes(props.record.status)))

const statusMeta = computed(() => {
  const status = props.record?.status ?? 'PENDING'
  const map: Record<string, { label: string, tone: string }> = {
    PENDING: { label: 'LIVE', tone: 'live' },
    GENERATING: { label: 'LIVE', tone: 'live' },
    REVIEWING: { label: 'LIVE', tone: 'live' },
    COMPLETED: { label: 'DONE', tone: 'done' },
    FAILED: { label: 'FAILED', tone: 'failed' },
    CANCELED: { label: 'STOP', tone: 'stop' },
  }
  return map[status] ?? { label: status, tone: 'stop' }
})

const outputModeLabel = computed(() => props.record?.outputMode === 'COMPLETE' ? '完整输出' : '实时流式输出')

const generationModelLabel = computed(() => {
  const event = [...sortedEvents.value].reverse().find(item => item.phase === 'GENERATING' && (item.provider || item.model))
  return formatModelLabel(event?.provider || props.record?.provider, event?.model || props.record?.model, 'GPT-5 Case Generator')
})

const reviewModelLabel = computed(() => {
  const event = [...sortedEvents.value].reverse().find(item => item.phase === 'REVIEWING' && (item.provider || item.model))
  return formatModelLabel(event?.provider, event?.model, 'GPT-5 Review Expert')
})

const elapsedLabel = computed(() => {
  const startedAt = parseTime(props.record?.createdAt)
  if (!startedAt) {
    return '00:00'
  }
  const endedAt = parseTime(props.record?.finishedAt || (isRunning.value ? null : props.record?.updatedAt)) || clockTick.value
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
})

const progressPercent = computed(() => {
  const record = props.record
  if (!record) {
    return 0
  }
  if (record.status === 'COMPLETED') {
    return 100
  }
  if (record.status === 'FAILED' || record.status === 'CANCELED') {
    return Math.max(16, Math.min(100, (record.currentStep ?? 1) * 24))
  }
  const generated = sortedEvents.value.filter(item => item.eventType === 'CASE_GENERATED').length
  const reviewed = sortedEvents.value.filter(item => ['CASE_REVIEWED', 'CASE_SUPPLEMENTED'].includes(item.eventType)).length
  if (record.status === 'REVIEWING') {
    return Math.min(92, 62 + reviewed * 4)
  }
  if (record.status === 'GENERATING') {
    return Math.min(58, 18 + generated * 4)
  }
  return 10
})

const consoleLines = computed(() => {
  if (props.loading) {
    return [{ key: 'loading', text: '> 正在加载生成日志...', tone: 'cyan', cursor: true }] satisfies ConsoleLine[]
  }
  if (!props.record) {
    return [{ key: 'empty', text: '> 暂无任务日志', tone: 'muted' }] satisfies ConsoleLine[]
  }

  const lines: ConsoleLine[] = []
  let generationSectionAdded = false
  let reviewSectionAdded = false
  let completeSectionAdded = false

  const addGenerationSection = () => {
    if (generationSectionAdded) {
      return
    }
    lines.push(sectionLine('generation-section', '========== 用例生成 =========='))
    generationSectionAdded = true
  }

  const addReviewSection = () => {
    if (reviewSectionAdded) {
      return
    }
    lines.push(sectionLine('review-section', '========== 实时AI评审 =========='))
    reviewSectionAdded = true
  }

  const addCompleteSection = () => {
    if (completeSectionAdded) {
      return
    }
    lines.push(sectionLine('complete-section', '========== 任务完成 =========='))
    completeSectionAdded = true
  }

  for (const event of sortedEvents.value) {
    if (event.eventType === 'TASK_CREATED') {
      lines.push(...buildTaskCreatedLines(event, props.record))
      continue
    }
    if (event.eventType === 'TASK_STARTED') {
      lines.push(buildTimedSystemLine(event, event.message || '请求已发送，模型处理中...', 'blue'))
      continue
    }
    if (event.eventType === 'GENERATION_MODEL_READY') {
      lines.push(buildTimedSystemLine(event, event.message || `生成模型已就绪: ${formatModelLabel(event.provider, event.model, generationModelLabel.value)}`, 'cyan'))
      continue
    }
    if (event.eventType === 'CASE_GENERATED') {
      addGenerationSection()
      lines.push(...buildCaseLines(event, getPayloadAsCase(event), event.itemIndex ?? 0))
      continue
    }
    if (event.eventType === 'GENERATION_COMPLETED') {
      lines.push(buildTimedSystemLine(event, event.message || `用例生成阶段完成: ${props.record.generatedCount ?? props.record.generatedCases.length} 条测试用例`, 'green', '✓'))
      continue
    }
    if (event.eventType === 'REVIEW_STARTED') {
      lines.push(buildTimedSystemLine(event, event.message || '开始执行 AI 自动评审', 'cyan'))
      continue
    }
    if (event.eventType === 'CASE_REVIEWED') {
      addReviewSection()
      lines.push(...buildReviewLines(event, parsePayload<ReviewPayload>(event.payloadJson), props.record.generatedCases[event.itemIndex ?? -1] ?? null))
      continue
    }
    if (event.eventType === 'CASE_SUPPLEMENTED') {
      addReviewSection()
      lines.push(...buildSupplementLines(event, parsePayload<ReviewPayload>(event.payloadJson), props.record.generatedCases[event.itemIndex ?? -1] ?? null))
      continue
    }
    if (event.eventType === 'REVIEW_COMPLETED') {
      lines.push(buildReviewCompletedLine(event, props.record))
      continue
    }
    if (event.eventType === 'FINAL_CASES_READY') {
      continue
    }
    if (event.eventType === 'TASK_COMPLETED') {
      addCompleteSection()
      lines.push(buildTimedSystemLine(event, `最终可用用例: ${props.record.generatedCases.length || props.record.generatedCount || 0} 条`, 'green', '✓'))
      lines.push(simpleLine(event, '✓ 流程结束，可查看结果或关闭窗口', 'green'))
      continue
    }
    if (event.eventType === 'TASK_FAILED') {
      lines.push(...buildFailureLines(event, props.record))
      continue
    }
    if (event.eventType === 'TASK_CANCELED') {
      lines.push(buildTimedSystemLine(event, event.message || '任务已取消', 'yellow', '■'))
      continue
    }
    lines.push(simpleLine(event, `> ${event.message || event.eventType}`, normalizeTone(event.level)))
  }

  if (!sortedEvents.value.some(item => item.eventType === 'CASE_GENERATED') && isTerminal.value && props.record.generatedCases.length) {
    addGenerationSection()
    props.record.generatedCases.forEach((item, index) => {
      lines.push(...buildCaseLines(null, item, index))
    })
  }

  if (!sortedEvents.value.some(item => ['CASE_REVIEWED', 'CASE_SUPPLEMENTED'].includes(item.eventType)) && isTerminal.value && props.record.generatedCases.some(item => item.aiReviewStatus)) {
    addReviewSection()
    props.record.generatedCases.forEach((item, index) => {
      lines.push(...buildCaseReviewSnapshotLines(item, index))
    })
  }

  if (!lines.length) {
    lines.push({ key: 'fallback', text: `> ${props.record.stepMessage || '任务已创建，等待 AI 返回实时日志...'}`, tone: 'cyan', cursor: isRunning.value })
  } else if (isRunning.value) {
    lines.push({ key: 'cursor', text: 'waiting for next event...', tone: 'muted', cursor: true })
  }

  return lines
})

function formatModelLabel(provider?: string | null, model?: string | null, fallback = '-') {
  if (model?.trim()) {
    return model.trim()
  }
  if (provider?.trim()) {
    return provider.trim()
  }
  return fallback
}

function parseTime(value?: string | null) {
  if (!value) {
    return null
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function formatEventTime(value?: string | null) {
  const parsed = parseTime(value)
  if (!parsed) {
    return ''
  }
  const date = new Date(parsed)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function parsePayload<T>(payload?: string | null) {
  if (!payload) {
    return null
  }
  try {
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}

function getPayloadAsCase(event: AiGenerationTaskEventItem) {
  return parsePayload<GeneratedAiCaseItem>(event.payloadJson)
}

function sectionLine(key: string, text: string): ConsoleLine {
  return { key, text, tone: 'cyan' }
}

function simpleLine(event: AiGenerationTaskEventItem | null, text: string, tone: ConsoleTone): ConsoleLine {
  return {
    key: event ? `event-${event.id}-${event.seq}-${text}` : `line-${text}`,
    text,
    tone,
  }
}

function buildTaskCreatedLines(event: AiGenerationTaskEventItem, record: AiGenerationTaskItem): ConsoleLine[] {
  const createdTime = formatEventTime(event.createdAt || record.createdAt)
  const triggerText = createdTime
    ? `# ${createdTime} 触发：AI生成测试用例`
    : '# 触发：AI生成测试用例'
  const outputModeText = record.outputMode === 'COMPLETE'
    ? '完整输出，等待模型返回完整内容'
    : '实时流式输出，模型生成后实时追加内容'
  return [
    simpleLine(event, triggerText, 'cyan'),
    { key: `event-${event.id}-${event.seq}-output-mode`, text: `> 输出方式：${outputModeText}`, tone: 'muted' },
  ]
}

function buildTimedSystemLine(event: AiGenerationTaskEventItem, text: string, tone: ConsoleTone, prefix = '>'): ConsoleLine {
  const eventTime = formatEventTime(event.createdAt)
  return simpleLine(event, eventTime ? `${prefix} ${eventTime} ${text}` : `${prefix} ${text}`, tone)
}

function buildCaseLines(event: AiGenerationTaskEventItem | null, item: GeneratedAiCaseItem | null, index: number): ConsoleLine[] {
  const normalizedIndex = index >= 0 ? index : 0
  const title = item?.title || event?.itemTitle || '未命名用例'
  const priority = item?.priority || 'P2'
  const prefix = event ? `event-${event.id}-${event.seq}` : `case-${normalizedIndex}`
  const lines: ConsoleLine[] = [
    { key: `${prefix}-title`, text: `[${priority}] CASE-${String(normalizedIndex + 1).padStart(3, '0')} ${title}`, tone: priority === 'P0' ? 'red' : 'yellow' },
  ]
  appendFieldLine(lines, `${prefix}-precondition`, '前置条件', item?.precondition, 'muted')
  appendFieldLine(lines, `${prefix}-steps`, '测试步骤', item?.steps, 'blue')
  appendFieldLine(lines, `${prefix}-expected`, '预期结果', item?.expectedResult, 'green')
  appendFieldLine(lines, `${prefix}-evidence`, '生成依据', item?.requirementEvidence || item?.generationReason, 'muted')
  appendFieldLine(lines, `${prefix}-risk`, '风险关注', item?.riskNotes, 'purple')
  return lines
}

function buildReviewLines(event: AiGenerationTaskEventItem, payload: ReviewPayload | null, finalCase: GeneratedAiCaseItem | null): ConsoleLine[] {
  const status = payload?.status || finalCase?.aiReviewStatus || ''
  const label = getReviewStatusLabel(status)
  const tone = getReviewTone(status)
  const index = event.itemIndex ?? 0
  const prefix = `event-${event.id}-${event.seq}`
  const lines: ConsoleLine[] = [
    { key: `${prefix}-title`, text: `[评审-${String(index + 1).padStart(2, '0')}] ${event.itemTitle || finalCase?.title || '未命名用例'}: ${label}`, tone },
  ]
  appendFieldLine(lines, `${prefix}-summary`, '理由', payload?.summary || finalCase?.aiReviewSummary || finalCase?.reviewComment, 'muted')
  appendFieldLine(lines, `${prefix}-coverage`, '覆盖', payload?.coverageComment, 'muted')
  appendFieldLine(lines, `${prefix}-evidence`, '依据评价', payload?.evidenceComment, 'muted')
  appendFieldLine(lines, `${prefix}-opt`, '优化原因', payload?.optimizationReason || finalCase?.optimizationReason, 'purple')
  appendFieldLine(lines, `${prefix}-gap`, '覆盖缺口', payload?.coverageGap || finalCase?.coverageGap, 'purple')
  if (status === 'OPTIMIZED') {
    lines.push({ key: `${prefix}-updated`, text: '  已更新用例内容，可在结果列表中查看最终版本', tone: 'purple', indent: true })
  }
  return lines
}

function buildSupplementLines(event: AiGenerationTaskEventItem, payload: ReviewPayload | null, finalCase: GeneratedAiCaseItem | null): ConsoleLine[] {
  const index = event.itemIndex ?? 0
  const prefix = `event-${event.id}-${event.seq}`
  const lines: ConsoleLine[] = [
    { key: `${prefix}-title`, text: `[补充-${String(index + 1).padStart(2, '0')}] ${event.itemTitle || finalCase?.title || '补充用例'}`, tone: 'yellow' },
  ]
  if (finalCase) {
    appendFieldLine(lines, `${prefix}-precondition`, '前置条件', finalCase.precondition, 'muted')
    appendFieldLine(lines, `${prefix}-steps`, '测试步骤', finalCase.steps, 'blue')
    appendFieldLine(lines, `${prefix}-expected`, '预期结果', finalCase.expectedResult, 'green')
  }
  appendFieldLine(lines, `${prefix}-reason`, '补充原因', payload?.supplementReason || finalCase?.supplementReason || payload?.coverageGap || finalCase?.coverageGap || payload?.summary, 'purple')
  return lines
}

function buildCaseReviewSnapshotLines(item: GeneratedAiCaseItem, index: number): ConsoleLine[] {
  const status = item.aiReviewStatus || ''
  const prefix = `snapshot-review-${index}`
  const lines: ConsoleLine[] = [
    { key: `${prefix}-title`, text: `[评审-${String(index + 1).padStart(2, '0')}] ${item.title}: ${getReviewStatusLabel(status)}`, tone: getReviewTone(status) },
  ]
  appendFieldLine(lines, `${prefix}-summary`, '理由', item.aiReviewSummary || item.reviewComment || item.optimizationReason || item.supplementReason, 'muted')
  appendFieldLine(lines, `${prefix}-opt`, '优化原因', item.optimizationReason, 'purple')
  appendFieldLine(lines, `${prefix}-gap`, '覆盖缺口', item.coverageGap, 'purple')
  if (status === 'OPTIMIZED') {
    lines.push({ key: `${prefix}-updated`, text: '  已更新用例内容，可在结果列表中查看最终版本', tone: 'purple', indent: true })
  }
  return lines
}

function buildReviewCompletedLine(event: AiGenerationTaskEventItem, record: AiGenerationTaskItem): ConsoleLine {
  const payload = parsePayload<{ optimized?: number, supplemented?: number, notRecommended?: number }>(event.payloadJson)
  const optimized = payload?.optimized ?? record.generatedCases.filter(item => item.aiReviewStatus === 'OPTIMIZED').length
  const supplemented = payload?.supplemented ?? record.generatedCases.filter(item => item.aiReviewStatus === 'SUPPLEMENTED').length
  const notRecommended = payload?.notRecommended ?? record.generatedCases.filter(item => item.aiReviewStatus === 'NOT_RECOMMENDED').length
  const confirmRequired = record.generatedCases.filter(item => item.aiReviewStatus === 'CONFIRM_REQUIRED').length
  const passed = record.generatedCases.filter(item => ['APPROVED', 'OPTIMIZED', 'SUPPLEMENTED'].includes(item.aiReviewStatus || '')).length
  return buildTimedSystemLine(event, `AI评审完成: 通过 ${passed} 条，已优化 ${optimized} 条，建议确认 ${confirmRequired} 条，补充 ${supplemented} 条，不建议 ${notRecommended} 条`, 'green', '✓')
}

function buildFailureLines(event: AiGenerationTaskEventItem, record: AiGenerationTaskItem): ConsoleLine[] {
  return [
    sectionLine(`event-${event.id}-${event.seq}-failed-section`, '========== 任务失败 =========='),
    buildTimedSystemLine(event, event.message || record.errorMessage || '任务执行失败', 'red', '✕'),
    { key: `event-${event.id}-${event.seq}-stage`, text: `  失败阶段: ${getFailureStageLabel(record.currentStep)}`, tone: 'muted', indent: true },
    { key: `event-${event.id}-${event.seq}-suggest`, text: '  建议: 可重新生成，或检查 AI 配置中的模型和提示词', tone: 'purple', indent: true },
  ]
}

function appendFieldLine(lines: ConsoleLine[], key: string, label: string, value: string | null | undefined, tone: ConsoleTone) {
  const normalized = value?.trim()
  if (!normalized) {
    return
  }
  lines.push({ key, text: `  ${label}: ${normalized}`, tone, indent: true })
}

function getReviewStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    APPROVED: '通过',
    OPTIMIZED: '已优化',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '不建议',
    REJECTED: '不建议',
    SUPPLEMENTED: '补充',
  }
  return status ? (map[status] ?? status) : '待评审'
}

function getReviewTone(status?: string | null): ConsoleTone {
  if (status === 'APPROVED') {
    return 'green'
  }
  if (status === 'NOT_RECOMMENDED' || status === 'REJECTED') {
    return 'red'
  }
  return 'yellow'
}

function normalizeTone(level?: string | null): ConsoleTone {
  if (level === 'ERROR') {
    return 'red'
  }
  if (level === 'WARN') {
    return 'yellow'
  }
  if (level === 'SUCCESS') {
    return 'green'
  }
  return 'cyan'
}

function getFailureStageLabel(step?: number | null) {
  const map: Record<number, string> = {
    1: '任务创建',
    2: 'AI 用例生成',
    3: 'AI 自动评审',
    4: '任务完成',
  }
  return step ? (map[step] ?? '当前阶段') : '当前阶段'
}

function isLogBodyAtBottom(target: HTMLElement) {
  return target.scrollHeight - target.scrollTop - target.clientHeight < 12
}

function scrollLogToBottom() {
  const target = logBodyRef.value
  if (!target) {
    return
  }
  target.scrollTop = target.scrollHeight
}

function handleLogScroll(event: Event) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    return
  }
  autoFollow.value = isLogBodyAtBottom(target)
}

watch(
  () => `${props.record?.taskId ?? ''}:${consoleLines.value.length}:${consoleLines.value.at(-1)?.key ?? ''}`,
  () => {
    if (!autoFollow.value) {
      return
    }
    void nextTick(scrollLogToBottom)
  },
  { immediate: true },
)

onMounted(() => {
  clockTimer = window.setInterval(() => {
    clockTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer !== null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
})
</script>

<template>
  <section class="ai-live-log-panel">
    <header class="ai-live-log-panel__top">
      <div class="ai-live-log-panel__traffic">
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <span>{{ title }}</span>
      </div>
      <span class="ai-live-log-panel__badge" :class="`is-${statusMeta.tone}`">
        <b />
        {{ statusMeta.label }}
      </span>
    </header>

    <div class="ai-live-log-panel__meta">
      <div>
        <span>生成模型</span>
        <strong>{{ generationModelLabel }}</strong>
      </div>
      <div>
        <span>评审模型</span>
        <strong>{{ reviewModelLabel }}</strong>
      </div>
      <div>
        <span>输出方式</span>
        <strong>{{ outputModeLabel }}</strong>
      </div>
      <div>
        <span>运行耗时</span>
        <strong>{{ elapsedLabel }}</strong>
      </div>
    </div>

    <div class="ai-live-log-panel__body">
      <div ref="logBodyRef" class="ai-live-log-panel__scroll" @scroll="handleLogScroll">
        <div class="ai-live-log-panel__log">
          <div
            v-for="line in consoleLines"
            :key="line.key"
            class="ai-live-log-panel__line"
            :class="[`is-${line.tone}`, { 'is-indent': line.indent, 'is-cursor': line.cursor }]"
          >
            {{ line.text }}
          </div>
        </div>
      </div>
    </div>

    <footer class="ai-live-log-panel__bottom">
      <div class="ai-live-log-panel__progress" aria-label="生成进度">
        <span :style="{ width: `${progressPercent}%` }" />
      </div>
      <slot name="actions" />
    </footer>
  </section>
</template>

<style scoped>
.ai-live-log-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  width: min(1060px, 100%);
  height: min(605px, calc(100vh - 52px));
  max-height: min(605px, calc(100vh - 52px));
  overflow: hidden;
  border: 1px solid #283242;
  border-radius: 10px;
  background: #02070d;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
}

.ai-live-log-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #26313f;
  background: #151b23;
}

.ai-live-log-panel__traffic {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ai-live-log-panel__traffic i {
  width: 9px;
  height: 9px;
  margin-right: 8px;
  border-radius: 50%;
}

.ai-live-log-panel__traffic i:nth-child(1) {
  background: #ff5f57;
}

.ai-live-log-panel__traffic i:nth-child(2) {
  background: #ffbd2e;
}

.ai-live-log-panel__traffic i:nth-child(3) {
  background: #28c840;
}

.ai-live-log-panel__traffic span {
  margin-left: 12px;
  overflow: hidden;
  color: #8ea1b8;
  font-family: var(--app-font-family-mono, Consolas, "Cascadia Mono", monospace);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-live-log-panel__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid rgba(34, 197, 94, 0.55);
  border-radius: 5px;
  background: rgba(34, 197, 94, 0.08);
  color: #7cff9e;
  font-family: var(--app-font-family-mono, Consolas, "Cascadia Mono", monospace);
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
}

.ai-live-log-panel__badge b {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.ai-live-log-panel__badge.is-done {
  border-color: rgba(34, 197, 94, 0.55);
  background: rgba(34, 197, 94, 0.08);
  color: #7cff9e;
}

.ai-live-log-panel__badge.is-failed {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.08);
  color: #fecaca;
}

.ai-live-log-panel__badge.is-stop {
  border-color: rgba(148, 163, 184, 0.5);
  background: rgba(148, 163, 184, 0.08);
  color: #b8c1cf;
}

.ai-live-log-panel__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: #26313f;
  border-bottom: 1px solid #26313f;
}

.ai-live-log-panel__meta div {
  min-width: 0;
  padding: 11px 14px;
  background: #0b1118;
}

.ai-live-log-panel__meta span {
  display: block;
  margin-bottom: 5px;
  color: #7789a3;
  font-size: 12px;
  line-height: 17px;
}

.ai-live-log-panel__meta strong {
  display: block;
  overflow: hidden;
  color: #e5efff;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-live-log-panel__body {
  min-height: 0;
  display: grid;
  overflow: hidden;
  background: #02070d;
}

.ai-live-log-panel__scroll {
  min-height: 0;
  height: 100%;
  overflow: auto;
  scrollbar-color: rgba(141, 161, 187, 0.36) transparent;
  scrollbar-width: thin;
}

.ai-live-log-panel__scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.ai-live-log-panel__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.ai-live-log-panel__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 161, 187, 0.34);
}

.ai-live-log-panel__scroll:hover::-webkit-scrollbar-thumb {
  background: rgba(141, 161, 187, 0.62);
}

.ai-live-log-panel__log {
  min-height: 100%;
  padding: 16px 18px 26px;
  font-family: Consolas, "Cascadia Mono", "SFMono-Regular", monospace;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.75;
  white-space: pre-wrap;
}

.ai-live-log-panel__line {
  min-height: 22px;
  color: #cde2ff;
  word-break: break-word;
}

.ai-live-log-panel__line.is-muted {
  color: #8da1bb;
}

.ai-live-log-panel__line.is-cyan {
  color: #60a5fa;
}

.ai-live-log-panel__line.is-green {
  color: #22c55e;
}

.ai-live-log-panel__line.is-yellow {
  color: #facc15;
}

.ai-live-log-panel__line.is-red {
  color: #ff5b5b;
}

.ai-live-log-panel__line.is-blue {
  color: #38bdf8;
}

.ai-live-log-panel__line.is-purple {
  color: #c084fc;
}

.ai-live-log-panel__line.is-white {
  color: #e5efff;
}

.ai-live-log-panel__line.is-cursor::after {
  content: "";
  display: inline-block;
  width: 8px;
  height: 15px;
  margin-left: 3px;
  transform: translateY(2px);
  background: #7cff9e;
  animation: ai-live-log-caret 0.8s steps(2, start) infinite;
}

.ai-live-log-panel__bottom {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #26313f;
  background: #0b1118;
}

.ai-live-log-panel__progress {
  flex: 1;
  min-width: 120px;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #182230;
}

.ai-live-log-panel__progress span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #22c55e);
  transition: width 260ms ease-out;
}

@keyframes ai-live-log-caret {
  50% {
    opacity: 0;
  }
}

@media (max-width: 768px) {
  .ai-live-log-panel {
    height: calc(100vh - 20px);
    max-height: calc(100vh - 20px);
  }

  .ai-live-log-panel__meta {
    grid-template-columns: 1fr;
  }

  .ai-live-log-panel__bottom {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
