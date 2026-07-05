import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecordingCompletionSummary,
  buildRecordingQualityCheck,
  hasFileUploadPathRisk,
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
  assert.equal(result.fileUploadPathRiskCount, 0)
  assert.deepEqual(result.checks.map(item => item.status), ['WARN', 'WARN', 'WARN', 'WARN', 'PASS', 'WARN'])
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

test('flags recorded file upload names that are not replayable paths or artifacts', () => {
  const result = buildRecordingQualityCheck({
    replayPassed: true,
    steps: [
      step({ type: 'FILE_UPLOAD', locatorType: 'CSS', locatorValue: '#file', inputValue: 'upload-demo.txt' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
  })

  assert.equal(result.fileUploadPathRiskCount, 1)
  assert.equal(result.ready, false)
  assert.equal(result.checks.some(item => item.key === 'UPLOADS' && item.status === 'WARN'), true)
})

test('flags artifact uploads that still need local file rebinding', () => {
  const result = buildRecordingQualityCheck({
    replayPassed: true,
    steps: [
      step({ type: 'FILE_UPLOAD', locatorType: 'CSS', locatorValue: '#file', inputValue: 'artifact:avatar' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
  })

  assert.equal(result.fileUploadPathRiskCount, 1)
  assert.equal(result.checks.find(item => item.key === 'UPLOADS')?.status, 'WARN')

  const repaired = buildRecordingQualityCheck({
    replayPassed: true,
    steps: [
      step({ type: 'FILE_UPLOAD', locatorType: 'CSS', locatorValue: '#file', inputValue: 'artifact:avatar' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
    uploadBindings: {
      avatar: {
        fileId: 'avatar',
        fileName: 'avatar.png',
        contentBase64: 'YWJj',
      },
    },
  })

  assert.equal(repaired.fileUploadPathRiskCount, 0)
  assert.equal(repaired.checks.find(item => item.key === 'UPLOADS')?.status, 'PASS')
})

test('accepts file upload artifacts and absolute paths as replayable values', () => {
  assert.equal(hasFileUploadPathRisk(step({ type: 'FILE_UPLOAD', inputValue: 'artifact:file-1' })), true)
  assert.equal(hasFileUploadPathRisk(step({ type: 'FILE_UPLOAD', inputValue: 'artifact:file-1' }), {
    'file-1': {
      fileId: 'file-1',
      fileName: 'file-1.txt',
      contentBase64: 'ZmlsZS0x',
    },
  }), false)
  assert.equal(hasFileUploadPathRisk(step({ type: 'FILE_UPLOAD', inputValue: 'D:/test/upload-demo.txt' })), false)
  assert.equal(hasFileUploadPathRisk(step({ type: 'FILE_UPLOAD', inputValue: '/tmp/upload-demo.txt' })), false)
  assert.equal(hasFileUploadPathRisk(step({ type: 'FILE_UPLOAD', inputValue: 'upload-demo.txt' })), true)
  assert.equal(hasFileUploadPathRisk(step({ type: 'CLICK', inputValue: 'upload-demo.txt' })), false)
})

test('summarizes recording completion stages from save quality and replay state', () => {
  const readyQuality = buildRecordingQualityCheck({
    replayPassed: true,
    steps: [
      step({ type: 'CLICK', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'submit' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
  })

  assert.equal(buildRecordingCompletionSummary({
    stepCount: 2,
    savedStepCount: 1,
    quality: readyQuality,
    replayPassed: true,
  }).stage, 'UNSAVED')

  assert.equal(buildRecordingCompletionSummary({
    stepCount: 2,
    savedStepCount: 2,
    quality: readyQuality,
    replayPassed: false,
  }).stage, 'REPLAY')

  assert.deepEqual(buildRecordingCompletionSummary({
    stepCount: 2,
    savedStepCount: 2,
    quality: readyQuality,
    replayPassed: true,
  }), {
    stage: 'COMPLETE',
    tone: 'success',
    title: '录制闭环已完成',
    summary: '用例已保存，上传与元素绑定已收口，最近一次本地回放已通过。',
    actionLabel: null,
    canRunReplay: false,
  })
})

test('prioritizes upload and element completion blockers before replay', () => {
  const uploadQuality = buildRecordingQualityCheck({
    replayPassed: false,
    steps: [
      step({ type: 'FILE_UPLOAD', locatorType: 'CSS', locatorValue: '#file', inputValue: 'artifact:avatar' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
  })
  assert.equal(buildRecordingCompletionSummary({
    stepCount: 2,
    savedStepCount: 2,
    quality: uploadQuality,
    replayPassed: false,
  }).stage, 'UPLOAD_REPAIR')

  const elementQuality = buildRecordingQualityCheck({
    replayPassed: false,
    steps: [
      step({ type: 'CLICK', elementId: null, locatorType: 'CSS', locatorValue: '#submit' }),
      step({ type: 'ASSERT_VISIBLE', elementId: 1, locatorType: 'TEST_ID', locatorValue: 'done' }),
    ],
  })
  const elementSummary = buildRecordingCompletionSummary({
    stepCount: 2,
    savedStepCount: 2,
    quality: elementQuality,
    replayPassed: false,
    elementCandidateCount: 1,
  })
  assert.equal(elementSummary.stage, 'ELEMENT_BINDING')
  assert.equal(elementSummary.actionLabel, '定位候选')
})

function step(overrides: Partial<RecordingQualityStep>): RecordingQualityStep {
  return {
    name: 'step',
    type: 'CLICK',
    elementId: 1,
    locatorType: 'CSS',
    locatorValue: '#target',
    inputValue: null,
    timeoutMs: null,
    enabled: true,
    ...overrides,
  }
}
