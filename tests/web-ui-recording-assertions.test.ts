import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecordingAssertionDraft,
  findNearestAssertableLocatorStep,
  type RecordingAssertionSourceStep,
} from '../src/entities/web-ui-automation/lib/recordingAssertions.ts'

test('finds the nearest previous locator step for recorded assertions', () => {
  const steps: RecordingAssertionSourceStep[] = [
    { name: '打开', type: 'OPEN' },
    { name: '输入姓名', type: 'FILL', locatorType: 'CSS', locatorValue: '#name' },
    { name: '按回车', type: 'PRESS_KEY' },
  ]

  const source = findNearestAssertableLocatorStep(steps, 2)

  assert.equal(source?.index, 1)
  assert.equal(source?.step.locatorValue, '#name')
})

test('builds visible assertion after the nearest locator step', () => {
  const result = buildRecordingAssertionDraft({
    steps: [
      { name: '打开', type: 'OPEN' },
      {
        name: '点击提交',
        type: 'CLICK',
        elementId: 12,
        elementName: '提交按钮',
        locatorType: 'CSS',
        locatorValue: ' button.submit ',
        framePath: [{ selector: 'iframe#checkout' }],
      },
    ],
    selectedIndex: 1,
    assertionType: 'ASSERT_VISIBLE',
  })

  assert.equal(result?.insertIndex, 2)
  assert.equal(result?.step.name, '断言 提交按钮 可见')
  assert.equal(result?.step.type, 'ASSERT_VISIBLE')
  assert.equal(result?.step.elementId, 12)
  assert.equal(result?.step.locatorValue, 'button.submit')
  assert.deepEqual(result?.step.framePath, [{ selector: 'iframe#checkout' }])
})

test('builds text assertion with expected text and cloned locator context', () => {
  const result = buildRecordingAssertionDraft({
    steps: [
      {
        name: '订单状态',
        type: 'CLICK',
        locatorType: 'TEXT',
        locatorValue: '订单状态',
        shadowPath: [{ selector: 'status-card' }],
      },
    ],
    selectedIndex: 0,
    assertionType: 'ASSERT_TEXT',
    expectedValue: ' 已支付 ',
  })

  assert.equal(result?.step.type, 'ASSERT_TEXT')
  assert.equal(result?.step.inputValue, '已支付')
  assert.deepEqual(result?.step.shadowPath, [{ selector: 'status-card' }])
})

test('builds url assertion without requiring a locator source', () => {
  const result = buildRecordingAssertionDraft({
    steps: [{ name: '打开', type: 'OPEN' }],
    selectedIndex: 0,
    assertionType: 'ASSERT_URL',
    expectedValue: '/orders',
  })

  assert.equal(result?.insertIndex, 1)
  assert.equal(result?.sourceIndex, null)
  assert.equal(result?.step.type, 'ASSERT_URL')
  assert.equal(result?.step.locatorType, null)
  assert.equal(result?.step.locatorValue, '')
  assert.equal(result?.step.inputValue, '/orders')
})

test('does not build locator assertions without a locator source', () => {
  assert.equal(buildRecordingAssertionDraft({
    steps: [{ name: '打开', type: 'OPEN' }],
    selectedIndex: 0,
    assertionType: 'ASSERT_VISIBLE',
  }), null)
})
