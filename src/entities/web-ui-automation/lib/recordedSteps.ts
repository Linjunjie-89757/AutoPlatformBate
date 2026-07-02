import { WEB_UI_LOCATOR_OPTIONS, WEB_UI_SCREENSHOT_POLICY_OPTIONS, WEB_UI_STEP_TYPE_OPTIONS } from '../model/options.ts'
import { requiresInput, requiresLocator } from './format.ts'

import type { LocalRunnerRecordedStep } from './localRunnerClient'
import type {
  WebUiCaseStepItem,
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

function normalizeRecordedLocatorType(value?: string | null): WebUiLocatorType | null {
  const normalized = String(value || '').toUpperCase() as WebUiLocatorType
  return WEB_UI_LOCATOR_OPTIONS.some(item => item.value === normalized) ? normalized : null
}

function normalizeRecordedScreenshotPolicy(value?: string | null): WebUiScreenshotPolicy {
  const normalized = String(value || '').toUpperCase() as WebUiScreenshotPolicy
  return WEB_UI_SCREENSHOT_POLICY_OPTIONS.some(item => item.value === normalized) ? normalized : 'ON_FAILURE'
}
