import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecordingQualityCheck,
  hasTimingRisk,
  isFragileLocatorStep,
  isUnboundLocatorStep,
  type RecordingQualityStep,
} from '../src/entities/web-ui-automation/lib/recordingQuality.ts'

test('marks recorded cases ready when assertions bindings locators timing and replay are healthy', () => {
  const result = buildRecordingQualityCheck({
    replayPassed: true,
    steps: [
      step({ type: 'CLICK', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'submit' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'submit' }),
    ],
  })

  assert.equal(result.ready, true)
  assert.equal(result.status, 'READY')
  assert.equal(result.score, 100)
  assert.equal(result.checks.every(item => item.status === 'PASS'), true)
})

test('reports missing assertions unbound elements fragile locators timing risks and missing replay', () => {
  const result = buildRecordingQualityCheck({
    replayPassed: false,
    steps: [
      step({ type: 'CLICK', elementId: null, locatorType: 'CSS', locatorValue: 'main > section > div:nth-child(3) button.submit' }),
      step({ type: 'WAIT_FOR', elementId: 2, locatorType: 'TEXT', locatorValue: '完成', timeoutMs: 1000 }),
    ],
  })

  assert.equal(result.ready, false)
  assert.equal(result.status, 'NEEDS_WORK')
  assert.equal(result.assertionCount, 0)
  assert.equal(result.unboundLocatorCount, 1)
  assert.equal(result.fragileLocatorCount, 1)
  assert.equal(result.timingRiskCount, 1)
  assert.deepEqual(result.checks.map(item => item.status), ['WARN', 'WARN', 'WARN', 'WARN', 'WARN'])
})

test('detects unbound locator steps only when locator data exists', () => {
  assert.equal(isUnboundLocatorStep(step({ type: 'CLICK', locatorType: 'CSS', locatorValue: '#submit', elementId: null })), true)
  assert.equal(isUnboundLocatorStep(step({ type: 'CLICK', locatorType: null, locatorValue: '', elementId: null })), false)
  assert.equal(isUnboundLocatorStep(step({ type: 'ASSERT_URL', locatorType: null, locatorValue: '', elementId: null })), false)
})

test('detects fragile xpath long css and nth-child locators', () => {
  assert.equal(isFragileLocatorStep(step({ locatorType: 'XPATH', locatorValue: '//div[3]/button' })), true)
  assert.equal(isFragileLocatorStep(step({ locatorType: 'CSS', locatorValue: 'main > section > div:nth-child(2) button' })), true)
  assert.equal(isFragileLocatorStep(step({ locatorType: 'TEST_ID', locatorValue: 'submit' })), false)
})

test('detects short wait and excessive timeout risks', () => {
  assert.equal(hasTimingRisk(step({ type: 'WAIT_FOR', timeoutMs: 1000 })), true)
  assert.equal(hasTimingRisk(step({ type: 'CLICK', timeoutMs: 60000 })), true)
  assert.equal(hasTimingRisk(step({ type: 'WAIT_FOR', timeoutMs: 5000 })), false)
})

function step(overrides: Partial<RecordingQualityStep>): RecordingQualityStep {
  return {
    name: 'step',
    type: 'CLICK',
    elementId: 1,
    locatorType: 'CSS',
    locatorValue: '#target',
    timeoutMs: null,
    enabled: true,
    ...overrides,
  }
}
