import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecordedLocatorKey,
  findMatchingWebUiElementForRecordedStep,
  toWebUiCollectCandidatesFromRecordedSteps,
  toWebUiCaseStepFromRecordedStep,
} from '../src/entities/web-ui-automation/lib/recordedSteps.ts'
import {
  WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY,
  buildRecordedCaseCollectSaveNavigationQuery,
} from '../src/entities/web-ui-automation/lib/collectTask.ts'

import type { LocalRunnerRecordedStep } from '../src/entities/web-ui-automation/lib/localRunnerClient.ts'
import type { WebUiElementItem } from '../src/entities/web-ui-automation/model/types.ts'

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

test('matches recorded steps to existing elements by exact locator context', () => {
  const matched = findMatchingWebUiElementForRecordedStep({
    locatorType: 'CSS',
    locatorValue: ' #name ',
    framePath: [{ selector: 'iframe#profile' }],
    shadowPath: null,
  }, [
    element({ id: 1, locatorValue: '#name' }),
    element({ id: 2, locatorValue: '#name', framePath: [{ selector: 'iframe#profile' }] }),
  ])

  assert.equal(matched?.id, 2)
})

test('does not match recorded locators when context differs or locator is empty', () => {
  const elements = [
    element({ id: 1, locatorValue: '#submit', shadowPath: ['toolbar-shell'] }),
  ]

  assert.equal(findMatchingWebUiElementForRecordedStep({
    locatorType: 'CSS',
    locatorValue: '#submit',
    framePath: null,
    shadowPath: null,
  }, elements), null)
  assert.equal(buildRecordedLocatorKey('CSS', '', null, null), '')
})

test('maps unmatched recorded locators into collect candidates', () => {
  const candidates = toWebUiCollectCandidatesFromRecordedSteps([
    {
      name: 'Click submit',
      type: 'CLICK',
      elementName: null,
      locatorType: 'CSS',
      locatorValue: ' button.submit ',
      framePath: [{ selector: 'iframe#checkout' }],
      shadowPath: null,
    },
  ], {
    groupName: 'Checkout',
  })

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].candidateSource, 'RECORDED_STEP')
  assert.equal(candidates[0].groupName, 'Checkout')
  assert.equal(candidates[0].elementName, 'Click submit')
  assert.equal(candidates[0].locatorValue, 'button.submit')
  assert.deepEqual(candidates[0].framePath, [{ selector: 'iframe#checkout', url: null, name: null, index: null }])
  assert.equal(candidates[0].recommendedToSave, true)
  assert.equal(candidates[0].validationStatus, 'UNVERIFIED')
})

test('skips duplicate or invalid recorded collect candidates', () => {
  const candidates = toWebUiCollectCandidatesFromRecordedSteps([
    {
      name: 'Submit',
      type: 'CLICK',
      elementName: null,
      locatorType: 'CSS',
      locatorValue: '#submit',
      framePath: null,
      shadowPath: null,
    },
    {
      name: 'Submit again',
      type: 'CLICK',
      elementName: null,
      locatorType: 'CSS',
      locatorValue: ' #submit ',
      framePath: null,
      shadowPath: null,
    },
    {
      name: 'Missing locator',
      type: 'CLICK',
      elementName: null,
      locatorType: 'CSS',
      locatorValue: '',
      framePath: null,
      shadowPath: null,
    },
  ])

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].elementName, 'Submit')
})

test('builds recorded case collect save query with auto rematch marker', () => {
  assert.deepEqual(buildRecordedCaseCollectSaveNavigationQuery({
    workspaceCode: 'account-open',
    collectTaskId: 42,
    savedCount: 2,
    skippedCount: 1,
  }), {
    workspace: 'account-open',
    workspaceCode: 'account-open',
    [WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY]: '1',
    collectTaskId: '42',
    saved: '2',
    skipped: '1',
  })
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

function element(overrides: Partial<WebUiElementItem>): WebUiElementItem {
  return {
    id: 1,
    workspaceCode: 'account-open',
    workspaceName: 'Account Open',
    pageId: null,
    groupId: null,
    pageName: 'Profile',
    groupName: 'Form',
    elementName: 'Name',
    locatorType: 'CSS',
    locatorValue: '#target',
    framePath: null,
    shadowPath: null,
    description: null,
    status: 'ENABLED',
    lastValidateResult: null,
    lastValidateAt: null,
    lastValidateMessage: null,
    lastMatchCount: null,
    createdAt: null,
    updatedAt: null,
    usageCount: 0,
    ...overrides,
  } as WebUiElementItem
}
