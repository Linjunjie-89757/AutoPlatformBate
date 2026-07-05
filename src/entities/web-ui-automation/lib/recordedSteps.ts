import { WEB_UI_LOCATOR_OPTIONS, WEB_UI_SCREENSHOT_POLICY_OPTIONS, WEB_UI_STEP_TYPE_OPTIONS } from '../model/options.ts'
import { requiresInput, requiresLocator } from './format.ts'

import type { LocalRunnerRecordedStep } from './localRunnerClient'
import type {
  WebUiCaseStepItem,
  WebUiElementCollectCandidate,
  WebUiElementItem,
  WebUiLocatorContextPathItem,
  WebUiLocatorType,
  WebUiScreenshotPolicy,
  WebUiStepType,
} from '../model/types'

export function toWebUiCaseStepFromRecordedStep(
  step: LocalRunnerRecordedStep,
  sortOrder: number,
): WebUiCaseStepItem | null {
  const type = normalizeRecordedStepType(step.type || step.stepType)
  if (!type) {
    return null
  }

  const locatorType = normalizeRecordedLocatorType(step.locatorType)
  const locatorValue = step.locatorValue?.trim() || ''
  if (requiresLocator(type) && (!locatorType || !locatorValue)) {
    return null
  }

  const inputValue = step.inputValue?.trim() || ''
  if (requiresInput(type) && !inputValue) {
    return null
  }

  return {
    id: null,
    name: step.name?.trim() || '',
    type,
    elementId: null,
    elementName: step.elementName || null,
    locatorType,
    locatorValue: locatorValue || null,
    framePath: step.framePath || null,
    shadowPath: step.shadowPath || null,
    inputValue: inputValue || null,
    timeoutMs: step.timeoutMs ?? null,
    continueOnFailure: Boolean(step.continueOnFailure),
    screenshotPolicy: normalizeRecordedScreenshotPolicy(step.screenshotPolicy),
    enabled: step.enabled !== false,
    sortOrder,
  }
}

export function findMatchingWebUiElementForRecordedStep(
  step: Pick<WebUiCaseStepItem, 'locatorType' | 'locatorValue' | 'framePath' | 'shadowPath'>,
  elements: WebUiElementItem[],
) {
  const key = buildRecordedLocatorKey(step.locatorType, step.locatorValue, step.framePath, step.shadowPath)
  if (!key) {
    return null
  }

  return elements.find(element => (
    buildRecordedLocatorKey(element.locatorType, element.locatorValue, element.framePath, element.shadowPath) === key
  )) || null
}

export function toWebUiCollectCandidatesFromRecordedSteps(
  steps: Pick<WebUiCaseStepItem, 'name' | 'type' | 'elementName' | 'locatorType' | 'locatorValue' | 'framePath' | 'shadowPath'>[],
  options: {
    groupName?: string | null
    screenshotBase64?: string | null
  } = {},
) {
  const seen = new Set<string>()
  const candidates: WebUiElementCollectCandidate[] = []

  steps.forEach((step) => {
    const candidate = toWebUiCollectCandidateFromRecordedStep(step, options)
    if (!candidate) {
      return
    }
    const key = buildRecordedLocatorKey(candidate.locatorType, candidate.locatorValue, candidate.framePath, candidate.shadowPath)
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    candidates.push(candidate)
  })

  return candidates
}

export function buildRecordedCollectCandidateFingerprint(
  candidates: Pick<WebUiElementCollectCandidate, 'locatorType' | 'locatorValue' | 'framePath' | 'shadowPath'>[],
) {
  return candidates
    .map(candidate => buildRecordedLocatorKey(candidate.locatorType, candidate.locatorValue, candidate.framePath, candidate.shadowPath))
    .filter(Boolean)
    .sort()
    .join('\n')
}

export function toWebUiCollectCandidateFromRecordedStep(
  step: Pick<WebUiCaseStepItem, 'name' | 'type' | 'elementName' | 'locatorType' | 'locatorValue' | 'framePath' | 'shadowPath'>,
  options: {
    groupName?: string | null
    screenshotBase64?: string | null
  } = {},
): WebUiElementCollectCandidate | null {
  const locatorType = normalizeRecordedLocatorType(step.locatorType)
  const locatorValue = String(step.locatorValue || '').trim()
  if (!locatorType || !locatorValue) {
    return null
  }

  const framePath = normalizeLocatorContextPath(step.framePath)
  const shadowPath = normalizeLocatorContextPath(step.shadowPath)
  const confidence = 80
  const elementName = buildRecordedCollectCandidateName(step, locatorValue)

  return {
    candidateSource: 'RECORDED_STEP',
    groupName: String(options.groupName || '').trim() || '录制候选元素',
    elementName,
    locatorType,
    locatorValue,
    framePath: framePath.length ? framePath : null,
    shadowPath: shadowPath.length ? shadowPath : null,
    locatorCandidates: [{
      locatorType,
      locatorValue,
      framePath: framePath.length ? framePath : null,
      shadowPath: shadowPath.length ? shadowPath : null,
      confidence,
      reason: '录制步骤主定位器',
    }],
    confidence,
    reason: '本地录制步骤生成',
    tagName: null,
    elementType: null,
    text: null,
    placeholder: null,
    ariaLabel: null,
    labelText: null,
    nearbyHeading: null,
    businessMeaning: elementName,
    recommendedToSave: true,
    notRecommendedReason: null,
    maintenanceSuggestion: '来自本地录制步骤，保存前请确认元素名称、分组和定位器。',
    stabilityNote: `录制定位器候选，初始稳定性评分 ${confidence}%`,
    validationStatus: 'UNVERIFIED',
    matchCount: null,
    validationMessage: '由本地录制生成，尚未经过本地页面验证',
    screenshotBase64: options.screenshotBase64 || null,
    saveBlockedReason: null,
  }
}

export function buildRecordedLocatorKey(
  locatorType?: WebUiLocatorType | string | null,
  locatorValue?: string | null,
  framePath?: WebUiLocatorContextPathItem[] | null,
  shadowPath?: WebUiLocatorContextPathItem[] | null,
) {
  const normalizedType = String(locatorType || '').trim().toUpperCase()
  const normalizedValue = String(locatorValue || '').trim()
  if (!normalizedType || !normalizedValue) {
    return ''
  }

  return [
    normalizedType,
    normalizedValue,
    JSON.stringify(normalizeLocatorContextPath(framePath)),
    JSON.stringify(normalizeLocatorContextPath(shadowPath)),
  ].join('::')
}

function buildRecordedCollectCandidateName(
  step: Pick<WebUiCaseStepItem, 'name' | 'elementName'>,
  locatorValue: string,
) {
  return String(step.elementName || step.name || locatorValue || '录制元素').trim()
}

function normalizeLocatorContextPath(value?: WebUiLocatorContextPathItem[] | null) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map(item => {
    if (typeof item === 'string') {
      return item
    }
    return {
      selector: item?.selector ?? null,
      url: item?.url ?? null,
      name: item?.name ?? null,
      index: item?.index ?? null,
    }
  })
}

function normalizeRecordedStepType(value?: string | null): WebUiStepType | null {
  const normalized = String(value || '').toUpperCase() as WebUiStepType
  return WEB_UI_STEP_TYPE_OPTIONS.some(item => item.value === normalized) ? normalized : null
}

function normalizeRecordedLocatorType(value?: WebUiLocatorType | string | null): WebUiLocatorType | null {
  const normalized = String(value || '').trim().toUpperCase() as WebUiLocatorType
  return WEB_UI_LOCATOR_OPTIONS.some(item => item.value === normalized) ? normalized : null
}

function normalizeRecordedScreenshotPolicy(value?: string | null): WebUiScreenshotPolicy {
  const normalized = String(value || '').toUpperCase() as WebUiScreenshotPolicy
  return WEB_UI_SCREENSHOT_POLICY_OPTIONS.some(item => item.value === normalized) ? normalized : 'ON_FAILURE'
}
