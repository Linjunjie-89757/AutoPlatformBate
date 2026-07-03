import { requiresLocator } from './format'
import type { WebUiLocatorType, WebUiStepType } from '../model/types'

export type RecordingQualityCheckStatus = 'PASS' | 'WARN'
export type RecordingQualityStatus = 'READY' | 'NEEDS_WORK'

export interface RecordingQualityStep {
  name?: string | null
  type?: WebUiStepType | string | null
  elementId?: number | null
  locatorType?: WebUiLocatorType | string | null
  locatorValue?: string | null
  timeoutMs?: number | null
  enabled?: boolean | null
  recordingElementMatchStatus?: string | null
}

export interface RecordingQualityCheckItem {
  key: 'ASSERTIONS' | 'ELEMENTS' | 'LOCATORS' | 'TIMING' | 'REPLAY'
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
}

export function buildRecordingQualityCheck(input: {
  steps: RecordingQualityStep[]
  replayPassed: boolean
}): RecordingQualityResult {
  const enabledSteps = input.steps.filter(step => step.enabled !== false)
  const assertionCount = enabledSteps.filter(isAssertionStep).length
  const unboundLocatorCount = enabledSteps.filter(isUnboundLocatorStep).length
  const fragileLocatorCount = enabledSteps.filter(isFragileLocatorStep).length
  const timingRiskCount = enabledSteps.filter(hasTimingRisk).length
  const checks: RecordingQualityCheckItem[] = [
    buildAssertionCheck(assertionCount),
    buildElementCheck(unboundLocatorCount),
    buildLocatorCheck(fragileLocatorCount),
    buildTimingCheck(timingRiskCount),
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

function buildReplayCheck(replayPassed: boolean): RecordingQualityCheckItem {
  return {
    key: 'REPLAY',
    label: '本地回放',
    status: replayPassed ? 'PASS' : 'WARN',
    summary: replayPassed ? '最近一次录制回放已通过' : '还没有录制回放通过记录',
    suggestion: replayPassed ? null : '保存后执行一次本地回放，通过后再沉淀为稳定用例。',
  }
}
