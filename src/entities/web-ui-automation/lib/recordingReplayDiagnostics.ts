import type { WebUiRunDetail, WebUiRunStepResult, WebUiStepType } from '../model/types'

type ReplayTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type ReplayIssueType = 'LOCATOR' | 'WAIT' | 'ASSERTION' | 'PAGE_STATE' | 'UNKNOWN'

export interface RecordingReplayTaskSnapshot {
  runId: string
  status: string
  currentStage?: string | null
  statusMessage?: string | null
  errorMessage?: string | null
  progress?: {
    current: number
    total: number
    percent: number
  } | null
}

export interface RecordingReplayDiagnostics {
  tone: ReplayTone
  title: string
  summary: string
  issueType: ReplayIssueType | null
  issueLabel: string | null
  suggestion: string | null
  failedStepSortOrder: number | null
  failedStepLabel: string | null
  failedStepDetail: string | null
  reportAvailable: boolean
}

export interface RecordingReplayRepairActions {
  collectLocatorCandidate: boolean
  applyTimeoutSuggestion: boolean
}

export function buildRecordingReplayDiagnostics(input: {
  replayRunId?: string | null
  task?: RecordingReplayTaskSnapshot | null
  runDetail?: WebUiRunDetail | null
}): RecordingReplayDiagnostics | null {
  const task = input.task || null
  if (!input.replayRunId || !task || task.runId !== input.replayRunId) {
    return null
  }

  const status = String(input.runDetail?.summary.status || task.status || '').toUpperCase()
  const reportAvailable = Boolean(input.runDetail)
  if (status === 'SUCCESS') {
    return {
      tone: 'success',
      title: '录制回放通过',
      summary: buildSuccessSummary(input.runDetail),
      issueType: null,
      issueLabel: null,
      suggestion: '这批录制步骤已通过 Local Runner 验证，可以进入断言补充或元素入库确认。',
      failedStepSortOrder: null,
      failedStepLabel: null,
      failedStepDetail: null,
      reportAvailable,
    }
  }

  if (status === 'FAILED') {
    const failedStep = findFailedReplayStep(input.runDetail)
    const message = failedStep?.errorMessage || task.errorMessage || task.statusMessage || input.runDetail?.summary.failureSummary || ''
    const issueType = classifyRecordingReplayFailure(message, failedStep?.stepType)
    return {
      tone: 'danger',
      title: '录制回放失败',
      summary: message || 'Local Runner 已返回失败，请查看正式报告中的步骤明细。',
      issueType,
      issueLabel: formatReplayIssueLabel(issueType),
      suggestion: suggestRecordingReplayFix(issueType),
      failedStepSortOrder: failedStep?.sortOrder || null,
      failedStepLabel: failedStep ? `第 ${failedStep.sortOrder} 步：${failedStep.stepName || failedStep.stepType}` : null,
      failedStepDetail: buildFailedStepDetail(failedStep),
      reportAvailable,
    }
  }

  if (status === 'CANCELED') {
    return {
      tone: 'warning',
      title: '录制回放已取消',
      summary: task.statusMessage || task.errorMessage || '本次录制回放任务已取消。',
      issueType: 'UNKNOWN',
      issueLabel: '任务中断',
      suggestion: '确认 Runner 未被手动停止后，可以重新点击本地运行或再次保存并回放。',
      failedStepSortOrder: null,
      failedStepLabel: null,
      failedStepDetail: null,
      reportAvailable,
    }
  }

  return {
    tone: 'primary',
    title: '录制回放运行中',
    summary: task.statusMessage || buildRunningSummary(task),
    issueType: null,
    issueLabel: null,
    suggestion: '等待 Runner 回传结果，完成后这里会给出通过或失败定位。',
    failedStepSortOrder: null,
    failedStepLabel: null,
    failedStepDetail: null,
    reportAvailable,
  }
}

export function buildRecordingReplayRepairActions(
  diagnostics: Pick<RecordingReplayDiagnostics, 'issueType' | 'failedStepSortOrder'> | null | undefined,
): RecordingReplayRepairActions {
  const hasFailedStep = Boolean(diagnostics?.failedStepSortOrder)
  return {
    collectLocatorCandidate: hasFailedStep && diagnostics?.issueType === 'LOCATOR',
    applyTimeoutSuggestion: hasFailedStep && diagnostics?.issueType === 'WAIT',
  }
}

export function classifyRecordingReplayFailure(message?: string | null, stepType?: WebUiStepType | string | null): ReplayIssueType {
  const value = String(message || '').toLowerCase()
  const normalizedStepType = String(stepType || '').toUpperCase()
  if (normalizedStepType.startsWith('ASSERT') || /\b(assert|expect|expected|actual)\b|断言/.test(value)) {
    return 'ASSERTION'
  }
  if (/strict mode|locator|selector|not found|not visible|no element|element.*detached|resolved to 0|waiting for selector/.test(value)) {
    return 'LOCATOR'
  }
  if (/timeout|timed out|waiting for|load state|navigation timeout|wait/.test(value)) {
    return 'WAIT'
  }
  if (/page|context|browser|closed|navigation|net::|login|url|file/.test(value)) {
    return 'PAGE_STATE'
  }
  return 'UNKNOWN'
}

function findFailedReplayStep(runDetail?: WebUiRunDetail | null) {
  return runDetail?.steps.find(step => step.status === 'FAILED') || null
}

function buildSuccessSummary(runDetail?: WebUiRunDetail | null) {
  const summary = runDetail?.summary
  if (!summary) {
    return 'Local Runner 已完成录制回放。'
  }
  return `已通过 ${summary.passedSteps}/${summary.totalSteps} 步，耗时 ${formatDuration(summary.durationMs)}`
}

function buildRunningSummary(task: RecordingReplayTaskSnapshot) {
  const progress = task.progress
  if (!progress || progress.total <= 0) {
    return 'Runner 正在执行录制回放任务。'
  }
  return `正在执行 ${progress.current}/${progress.total} 步，阶段 ${task.currentStage || '-'}`
}

function buildFailedStepDetail(step?: WebUiRunStepResult | null) {
  if (!step) {
    return null
  }
  const target = step.locatorValue ? `定位：${step.locatorValue}` : '未记录定位值'
  return `${step.stepType} · ${target}`
}

function formatReplayIssueLabel(issueType: ReplayIssueType) {
  if (issueType === 'LOCATOR') return '定位器问题'
  if (issueType === 'WAIT') return '等待或时序问题'
  if (issueType === 'ASSERTION') return '断言不匹配'
  if (issueType === 'PAGE_STATE') return '页面状态问题'
  return '未分类问题'
}

function suggestRecordingReplayFix(issueType: ReplayIssueType) {
  if (issueType === 'LOCATOR') {
    return '优先检查该步骤定位器是否稳定，必要时重新匹配元素库或采集候选元素。'
  }
  if (issueType === 'WAIT') {
    return '检查页面加载或接口响应是否变慢，可增加等待步骤或调整该步骤超时时间。'
  }
  if (issueType === 'ASSERTION') {
    return '检查断言期望值是否依赖动态文案，必要时改为更稳定的包含校验。'
  }
  if (issueType === 'PAGE_STATE') {
    return '检查登录态、基础地址、页面跳转或上传文件等执行前置条件是否仍然有效。'
  }
  return '查看正式报告截图和错误信息，确认是页面状态、定位器还是断言配置导致。'
}

function formatDuration(durationMs?: number | null) {
  const value = Number(durationMs || 0)
  if (!Number.isFinite(value) || value <= 0) {
    return '-'
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`
  }
  return `${(value / 1000).toFixed(1)}s`
}
