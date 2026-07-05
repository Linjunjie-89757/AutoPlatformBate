import { requiresLocator } from './format.ts'
import { getWebUiFileUploadReplayIssue, type WebUiFileUploadArtifactBinding } from './fileUploadArtifacts.ts'
import type { WebUiLocatorType, WebUiStepType } from '../model/types'

export type RecordingQualityCheckStatus = 'PASS' | 'WARN'
export type RecordingQualityStatus = 'READY' | 'NEEDS_WORK'
export type RecordingCompletionStage =
  | 'EMPTY'
  | 'UNSAVED'
  | 'UPLOAD_REPAIR'
  | 'ELEMENT_BINDING'
  | 'QUALITY_FIX'
  | 'REPLAY'
  | 'COMPLETE'

export interface RecordingQualityStep {
  name?: string | null
  type?: WebUiStepType | string | null
  elementId?: number | null
  locatorType?: WebUiLocatorType | string | null
  locatorValue?: string | null
  inputValue?: string | null
  timeoutMs?: number | null
  enabled?: boolean | null
  recordingElementMatchStatus?: string | null
}

export interface RecordingQualityCheckItem {
  key: 'ASSERTIONS' | 'ELEMENTS' | 'LOCATORS' | 'TIMING' | 'UPLOADS' | 'REPLAY'
  label: string
  status: RecordingQualityCheckStatus
  summary: string
  suggestion: string | null
}

export interface RecordingQualityResult {
  status: RecordingQualityStatus
  score: number
  ready: boolean
  title: string
  summary: string
  checks: RecordingQualityCheckItem[]
  assertionCount: number
  unboundLocatorCount: number
  fragileLocatorCount: number
  timingRiskCount: number
  fileUploadPathRiskCount: number
}

export interface RecordingCompletionSummary {
  stage: RecordingCompletionStage
  tone: 'info' | 'warning' | 'success'
  title: string
  summary: string
  actionLabel: string | null
  canRunReplay: boolean
}

export function buildRecordingQualityCheck(input: {
  steps: RecordingQualityStep[]
  replayPassed: boolean
  uploadBindings?: Record<string, WebUiFileUploadArtifactBinding | undefined>
}): RecordingQualityResult {
  const enabledSteps = input.steps.filter(step => step.enabled !== false)
  const assertionCount = enabledSteps.filter(isAssertionStep).length
  const unboundLocatorCount = enabledSteps.filter(isUnboundLocatorStep).length
  const fragileLocatorCount = enabledSteps.filter(isFragileLocatorStep).length
  const timingRiskCount = enabledSteps.filter(hasTimingRisk).length
  const fileUploadPathRiskCount = enabledSteps.filter(step => hasFileUploadPathRisk(step, input.uploadBindings)).length
  const checks: RecordingQualityCheckItem[] = [
    buildAssertionCheck(assertionCount),
    buildElementCheck(unboundLocatorCount),
    buildLocatorCheck(fragileLocatorCount),
    buildTimingCheck(timingRiskCount),
    buildFileUploadCheck(fileUploadPathRiskCount),
    buildReplayCheck(input.replayPassed),
  ]
  const passCount = checks.filter(item => item.status === 'PASS').length
  const score = Math.round((passCount / checks.length) * 100)
  const ready = passCount === checks.length

  return {
    status: ready ? 'READY' : 'NEEDS_WORK',
    score,
    ready,
    title: ready ? '可以沉淀为稳定用例' : '还有质量项需要处理',
    summary: ready
      ? '录制用例已具备断言、稳定定位和本地回放验证。'
      : `${checks.length - passCount} 项需要处理后再沉淀为稳定资产。`,
    checks,
    assertionCount,
    unboundLocatorCount,
    fragileLocatorCount,
    timingRiskCount,
    fileUploadPathRiskCount,
  }
}

export function buildRecordingCompletionSummary(input: {
  stepCount: number
  savedStepCount: number
  quality: Pick<RecordingQualityResult, 'ready' | 'assertionCount' | 'fragileLocatorCount' | 'timingRiskCount' | 'unboundLocatorCount' | 'fileUploadPathRiskCount'>
  replayPassed: boolean
  elementCandidateCount?: number | null
}): RecordingCompletionSummary {
  const stepCount = Math.max(0, Number(input.stepCount || 0))
  const savedStepCount = Math.max(0, Number(input.savedStepCount || 0))
  const elementCandidateCount = Math.max(0, Number(input.elementCandidateCount || 0))

  if (stepCount <= 0) {
    return {
      stage: 'EMPTY',
      tone: 'info',
      title: '还没有录制步骤',
      summary: '先录制或新增步骤，再进行保存、本地回放和质量收口。',
      actionLabel: null,
      canRunReplay: false,
    }
  }

  if (savedStepCount !== stepCount) {
    return {
      stage: 'UNSAVED',
      tone: 'warning',
      title: '录制步骤待保存',
      summary: `当前 ${stepCount} 步，已保存 ${savedStepCount} 步；请先保存后再本地回放。`,
      actionLabel: '保存并本地回放',
      canRunReplay: true,
    }
  }

  if (input.quality.fileUploadPathRiskCount > 0) {
    return {
      stage: 'UPLOAD_REPAIR',
      tone: 'warning',
      title: '文件上传待修复',
      summary: `还有 ${input.quality.fileUploadPathRiskCount} 个文件上传步骤缺少可回放绑定。`,
      actionLabel: '定位上传问题',
      canRunReplay: false,
    }
  }

  if (input.quality.unboundLocatorCount > 0) {
    const candidateText = elementCandidateCount > 0 ? `，其中 ${elementCandidateCount} 个已标记为候选` : ''
    return {
      stage: 'ELEMENT_BINDING',
      tone: 'warning',
      title: '元素绑定待收口',
      summary: `还有 ${input.quality.unboundLocatorCount} 个定位步骤未绑定元素库${candidateText}。`,
      actionLabel: elementCandidateCount > 0 ? '定位候选' : '候选入库',
      canRunReplay: false,
    }
  }

  if (!input.quality.ready && (input.quality.assertionCount <= 0 || input.quality.fragileLocatorCount > 0 || input.quality.timingRiskCount > 0)) {
    return {
      stage: 'QUALITY_FIX',
      tone: 'warning',
      title: '质量项待处理',
      summary: '断言、定位器稳定性或等待配置仍有风险，建议处理后再沉淀。',
      actionLabel: null,
      canRunReplay: false,
    }
  }

  if (!input.replayPassed) {
    return {
      stage: 'REPLAY',
      tone: 'warning',
      title: '等待本地回放通过',
      summary: '步骤已保存且关键修复项已处理，请执行一次本地回放验证。',
      actionLabel: '保存并本地回放',
      canRunReplay: true,
    }
  }

  return {
    stage: 'COMPLETE',
    tone: 'success',
    title: '录制闭环已完成',
    summary: '用例已保存，上传与元素绑定已收口，最近一次本地回放已通过。',
    actionLabel: null,
    canRunReplay: false,
  }
}

export function isAssertionStep(step: RecordingQualityStep) {
  return String(step.type || '').startsWith('ASSERT')
}

export function isUnboundLocatorStep(step: RecordingQualityStep) {
  return Boolean(
    requiresLocator(step.type)
    && !step.elementId
    && step.locatorType
    && step.locatorValue?.trim(),
  )
}

export function isFragileLocatorStep(step: RecordingQualityStep) {
  const locatorType = String(step.locatorType || '').toUpperCase()
  const locatorValue = step.locatorValue?.trim() || ''
  if (!locatorValue) {
    return false
  }
  if (locatorType === 'XPATH') {
    return true
  }
  if (locatorType !== 'CSS') {
    return false
  }
  return locatorValue.length > 120
    || /nth-child|nth-of-type|>\s*[^>]+\s*>\s*[^>]+/.test(locatorValue)
}

export function hasTimingRisk(step: RecordingQualityStep) {
  const timeoutMs = Number(step.timeoutMs || 0)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return false
  }
  if (String(step.type || '') === 'WAIT_FOR' && timeoutMs < 3000) {
    return true
  }
  return timeoutMs > 45000
}

export function hasFileUploadPathRisk(
  step: RecordingQualityStep,
  uploadBindings: Record<string, WebUiFileUploadArtifactBinding | undefined> = {},
) {
  return getWebUiFileUploadReplayIssue(step, uploadBindings) !== null
}

function buildAssertionCheck(assertionCount: number): RecordingQualityCheckItem {
  return {
    key: 'ASSERTIONS',
    label: '断言覆盖',
    status: assertionCount > 0 ? 'PASS' : 'WARN',
    summary: assertionCount > 0 ? `已有 ${assertionCount} 个断言` : '还没有断言',
    suggestion: assertionCount > 0 ? null : '至少补一个可见、文本或 URL 断言，避免只验证流程不验证结果。',
  }
}

function buildElementCheck(unboundLocatorCount: number): RecordingQualityCheckItem {
  return {
    key: 'ELEMENTS',
    label: '元素绑定',
    status: unboundLocatorCount === 0 ? 'PASS' : 'WARN',
    summary: unboundLocatorCount === 0 ? '定位步骤都已绑定元素或无需绑定' : `${unboundLocatorCount} 个定位步骤未绑定元素库`,
    suggestion: unboundLocatorCount === 0 ? null : '优先候选入库或重新匹配，让录制步骤使用元素库资产。',
  }
}

function buildLocatorCheck(fragileLocatorCount: number): RecordingQualityCheckItem {
  return {
    key: 'LOCATORS',
    label: '定位器稳定性',
    status: fragileLocatorCount === 0 ? 'PASS' : 'WARN',
    summary: fragileLocatorCount === 0 ? '未发现明显脆弱定位器' : `${fragileLocatorCount} 个定位器可能不稳定`,
    suggestion: fragileLocatorCount === 0 ? null : '尽量用 Test ID、Role、Label 或短 CSS 替代 XPath、nth-child 和过长 CSS。',
  }
}

function buildTimingCheck(timingRiskCount: number): RecordingQualityCheckItem {
  return {
    key: 'TIMING',
    label: '等待与超时',
    status: timingRiskCount === 0 ? 'PASS' : 'WARN',
    summary: timingRiskCount === 0 ? '未发现明显等待风险' : `${timingRiskCount} 个步骤等待或超时需要复核`,
    suggestion: timingRiskCount === 0 ? null : '短等待可能导致偶发失败，过长超时会拖慢回归，建议按页面实际耗时调整。',
  }
}

function buildFileUploadCheck(fileUploadPathRiskCount: number): RecordingQualityCheckItem {
  return {
    key: 'UPLOADS',
    label: '文件上传路径',
    status: fileUploadPathRiskCount === 0 ? 'PASS' : 'WARN',
    summary: fileUploadPathRiskCount === 0 ? '文件上传步骤已具备回放条件' : `${fileUploadPathRiskCount} 个文件上传步骤需要重新绑定或改成可回放路径`,
    suggestion: fileUploadPathRiskCount === 0 ? null : '录制通常只能拿到文件名；请改成本机绝对路径，或重新选择文件生成 artifact 引用后再回放。',
  }
}

function buildReplayCheck(replayPassed: boolean): RecordingQualityCheckItem {
  return {
    key: 'REPLAY',
    label: '本地回放',
    status: replayPassed ? 'PASS' : 'WARN',
    summary: replayPassed ? '最近一次录制回放已通过' : '还没有录制回放通过记录',
    suggestion: replayPassed ? null : '保存后执行一次本地回放，通过后再沉淀为稳定用例。',
  }
}
