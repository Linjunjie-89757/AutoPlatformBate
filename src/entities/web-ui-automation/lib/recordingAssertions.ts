import type {
  WebUiLocatorContextPathItem,
  WebUiLocatorType,
  WebUiScreenshotPolicy,
  WebUiStepType,
} from '../model/types'

export type RecordingAssertionType = 'ASSERT_VISIBLE' | 'ASSERT_TEXT' | 'ASSERT_URL'

export interface RecordingAssertionSourceStep {
  id?: number | null
  name?: string | null
  type?: WebUiStepType | string | null
  elementId?: number | null
  elementName?: string | null
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  sortOrder?: number | null
}

export interface RecordingAssertionStepDraft {
  id: null
  name: string
  type: RecordingAssertionType
  elementId: number | null
  elementName: string | null
  locatorType: WebUiLocatorType | null
  locatorValue: string
  framePath: WebUiLocatorContextPathItem[] | null
  shadowPath: WebUiLocatorContextPathItem[] | null
  inputValue: string
  timeoutMs: number | null
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy
  enabled: boolean
  sortOrder: number
}

export interface RecordingAssertionDraftResult {
  insertIndex: number
  sourceIndex: number | null
  step: RecordingAssertionStepDraft
}

export function buildRecordingAssertionDraft(input: {
  steps: RecordingAssertionSourceStep[]
  selectedIndex: number
  assertionType: RecordingAssertionType
  expectedValue?: string | null
}): RecordingAssertionDraftResult | null {
  const selectedIndex = clampSelectedIndex(input.selectedIndex, input.steps.length)
  if (input.assertionType === 'ASSERT_URL') {
    const insertIndex = Math.min(input.steps.length, selectedIndex + 1)
    return {
      insertIndex,
      sourceIndex: null,
      step: buildAssertionStep({
        assertionType: input.assertionType,
        sortOrder: insertIndex + 1,
        expectedValue: input.expectedValue,
      }),
    }
  }

  const source = findNearestAssertableLocatorStep(input.steps, selectedIndex)
  if (!source) {
    return null
  }

  const insertIndex = source.index + 1
  return {
    insertIndex,
    sourceIndex: source.index,
    step: buildAssertionStep({
      assertionType: input.assertionType,
      sortOrder: insertIndex + 1,
      sourceStep: source.step,
      expectedValue: input.expectedValue,
    }),
  }
}

export function findNearestAssertableLocatorStep(
  steps: RecordingAssertionSourceStep[],
  selectedIndex: number,
) {
  const startIndex = clampSelectedIndex(selectedIndex, steps.length)
  for (let index = startIndex; index >= 0; index -= 1) {
    const step = steps[index]
    if (step?.locatorType && step.locatorValue?.trim()) {
      return { index, step }
    }
  }
  return null
}

function buildAssertionStep(input: {
  assertionType: RecordingAssertionType
  sortOrder: number
  sourceStep?: RecordingAssertionSourceStep | null
  expectedValue?: string | null
}): RecordingAssertionStepDraft {
  const source = input.sourceStep || null
  const targetName = source?.elementName || source?.name || source?.locatorValue || ''
  return {
    id: null,
    name: buildAssertionStepName(input.assertionType, targetName),
    type: input.assertionType,
    elementId: input.assertionType === 'ASSERT_URL' ? null : source?.elementId ?? null,
    elementName: input.assertionType === 'ASSERT_URL' ? null : source?.elementName || null,
    locatorType: input.assertionType === 'ASSERT_URL' ? null : source?.locatorType || null,
    locatorValue: input.assertionType === 'ASSERT_URL' ? '' : source?.locatorValue?.trim() || '',
    framePath: input.assertionType === 'ASSERT_URL' ? null : cloneContextPath(source?.framePath),
    shadowPath: input.assertionType === 'ASSERT_URL' ? null : cloneContextPath(source?.shadowPath),
    inputValue: input.expectedValue?.trim() || '',
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'ON_FAILURE',
    enabled: true,
    sortOrder: input.sortOrder,
  }
}

function buildAssertionStepName(assertionType: RecordingAssertionType, targetName: string) {
  const target = targetName.trim()
  if (assertionType === 'ASSERT_VISIBLE') {
    return target ? `断言 ${target} 可见` : '断言元素可见'
  }
  if (assertionType === 'ASSERT_TEXT') {
    return target ? `断言 ${target} 文本` : '断言元素文本'
  }
  return '断言当前 URL'
}

function cloneContextPath(value?: WebUiLocatorContextPathItem[] | null) {
  return value?.length
    ? value.map(item => (typeof item === 'string' ? item : { ...item }))
    : null
}

function clampSelectedIndex(selectedIndex: number, length: number) {
  if (length <= 0) {
    return 0
  }
  if (!Number.isFinite(selectedIndex)) {
    return length - 1
  }
  return Math.max(0, Math.min(Math.floor(selectedIndex), length - 1))
}
