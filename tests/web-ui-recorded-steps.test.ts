import test from 'node:test'
import assert from 'node:assert/strict'

import { toWebUiCaseStepFromRecordedStep } from '../src/entities/web-ui-automation/lib/recordedSteps.ts'

import type { LocalRunnerRecordedStep } from '../src/entities/web-ui-automation/lib/localRunnerClient.ts'

test('maps local runner recorded steps into save-compatible web ui case steps', () => {
  const step = toWebUiCaseStepFromRecordedStep(recordedStep({
    name: ' 输入 Alice ',
    type: 'FILL',
    stepType: 'FILL',
    elementName: 'Name',
    locatorType: 'css',
    locatorValue: ' #name ',
    framePath: [{ selector: 'iframe#profile' }],
    inputValue: ' Alice ',
    timeoutMs: 2500,
    screenshotPolicy: 'none',
  }), 3)

  assert.deepEqual(step, {
    id: null,
    name: '输入 Alice',
    type: 'FILL',
    elementId: null,
    elementName: 'Name',
    locatorType: 'CSS',
    locatorValue: '#name',
    framePath: [{ selector: 'iframe#profile' }],
    shadowPath: null,
    inputValue: 'Alice',
    timeoutMs: 2500,
    continueOnFailure: false,
    screenshotPolicy: 'NONE',
    enabled: true,
    sortOrder: 3,
  })
})

test('drops recorded steps that would fail case save validation', () => {
  assert.equal(toWebUiCaseStepFromRecordedStep(recordedStep({ type: 'UNKNOWN', stepType: 'UNKNOWN' }), 1), null)
  assert.equal(toWebUiCaseStepFromRecordedStep(recordedStep({ type: 'CLICK', stepType: 'CLICK', locatorValue: '' }), 1), null)
  assert.equal(toWebUiCaseStepFromRecordedStep(recordedStep({ type: 'FILL', stepType: 'FILL', inputValue: '' }), 1), null)
})

test('keeps global key recordings without forcing a locator', () => {
  const step = toWebUiCaseStepFromRecordedStep(recordedStep({
    type: 'PRESS_KEY',
    stepType: 'PRESS_KEY',
    locatorType: null,
    locatorValue: null,
    inputValue: 'Enter',
  }), 4)

  assert.equal(step?.type, 'PRESS_KEY')
  assert.equal(step?.locatorType, null)
  assert.equal(step?.locatorValue, null)
  assert.equal(step?.inputValue, 'Enter')
})

function recordedStep(overrides: Partial<LocalRunnerRecordedStep>): LocalRunnerRecordedStep {
  return {
    id: null,
    name: 'Recorded step',
    type: 'CLICK',
    stepType: 'CLICK',
    elementId: null,
    elementName: null,
    locatorType: 'CSS',
    locatorValue: '#target',
    framePath: null,
    shadowPath: null,
    inputValue: null,
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'ON_FAILURE',
    enabled: true,
    sortOrder: 1,
    ...overrides,
  } as LocalRunnerRecordedStep
}
