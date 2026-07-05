import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRecordingReplayDiagnostics,
  buildRecordingReplayRepairActions,
  buildRecordingReplayRerunPrompt,
  buildRecordingReplayStepContext,
  classifyRecordingReplayFailure,
  type RecordingReplayTaskSnapshot,
} from '../src/entities/web-ui-automation/lib/recordingReplayDiagnostics.ts'
import type { WebUiRunDetail, WebUiRunStepResult } from '../src/entities/web-ui-automation/model/types.ts'

test('does not build replay diagnostics for unrelated local runner tasks', () => {
  assert.equal(buildRecordingReplayDiagnostics({
    replayRunId: 'replay-run',
    task: taskSnapshot({ runId: 'manual-run', status: 'SUCCESS' }),
  }), null)
})

test('summarizes successful recording replay result', () => {
  const diagnostics = buildRecordingReplayDiagnostics({
    replayRunId: 'replay-run',
    task: taskSnapshot({ runId: 'replay-run', status: 'SUCCESS' }),
    runDetail: runDetail({
      status: 'SUCCESS',
      totalSteps: 3,
      passedSteps: 3,
      durationMs: 1234,
    }),
  })

  assert.equal(diagnostics?.tone, 'success')
  assert.equal(diagnostics?.title, '录制回放通过')
  assert.equal(diagnostics?.summary, '已通过 3/3 步，耗时 1.2s')
  assert.equal(diagnostics?.failedStepSortOrder, null)
})

test('locates failed recording replay steps and classifies locator failures', () => {
  const diagnostics = buildRecordingReplayDiagnostics({
    replayRunId: 'replay-run',
    task: taskSnapshot({ runId: 'replay-run', status: 'FAILED' }),
    runDetail: runDetail({
      status: 'FAILED',
      failureSummary: 'Replay failed',
      steps: [
        runStep({ sortOrder: 1, status: 'PASSED' }),
        runStep({
          sortOrder: 2,
          stepName: '点击提交',
          status: 'FAILED',
          locatorValue: 'button.submit',
          errorMessage: 'locator resolved to 0 elements',
        }),
      ],
    }),
  })

  assert.equal(diagnostics?.tone, 'danger')
  assert.equal(diagnostics?.failedStepSortOrder, 2)
  assert.equal(diagnostics?.failedStepLabel, '第 2 步：点击提交')
  assert.equal(diagnostics?.issueType, 'LOCATOR')
  assert.equal(diagnostics?.issueLabel, '定位器问题')
  assert.match(diagnostics?.suggestion || '', /定位器/)
})

test('summarizes degraded recording replay as terminal repairable result', () => {
  const diagnostics = buildRecordingReplayDiagnostics({
    replayRunId: 'replay-run',
    task: taskSnapshot({ runId: 'replay-run', status: 'DEGRADED' }),
    runDetail: runDetail({
      status: 'DEGRADED',
      failureSummary: 'Replay degraded',
      steps: [
        runStep({
          sortOrder: 3,
          stepName: '等待订单状态',
          stepType: 'WAIT',
          status: 'FAILED',
          errorMessage: 'Timeout 30000ms exceeded waiting for response',
        }),
      ],
    }),
  })

  assert.equal(diagnostics?.tone, 'warning')
  assert.equal(diagnostics?.title, '录制回放未完全通过')
  assert.equal(diagnostics?.failedStepSortOrder, 3)
  assert.equal(diagnostics?.issueType, 'WAIT')
  assert.match(diagnostics?.suggestion || '', /超时时间/)
})

test('classifies common replay failure categories', () => {
  assert.equal(classifyRecordingReplayFailure('expect text to contain paid', 'ASSERT_TEXT'), 'ASSERTION')
  assert.equal(classifyRecordingReplayFailure('Timeout 30000ms exceeded waiting for load state', 'CLICK'), 'WAIT')
  assert.equal(classifyRecordingReplayFailure('page closed during navigation', 'OPEN'), 'PAGE_STATE')
  assert.equal(classifyRecordingReplayFailure('unexpected failure', 'CLICK'), 'UNKNOWN')
})

test('builds repair actions from replay diagnostics issue type', () => {
  assert.deepEqual(buildRecordingReplayRepairActions({
    issueType: 'LOCATOR',
    failedStepSortOrder: 2,
  }), {
    collectLocatorCandidate: true,
    applyTimeoutSuggestion: false,
  })
  assert.deepEqual(buildRecordingReplayRepairActions({
    issueType: 'WAIT',
    failedStepSortOrder: 3,
  }), {
    collectLocatorCandidate: false,
    applyTimeoutSuggestion: true,
  })
  assert.deepEqual(buildRecordingReplayRepairActions({
    issueType: 'LOCATOR',
    failedStepSortOrder: null,
  }), {
    collectLocatorCandidate: false,
    applyTimeoutSuggestion: false,
  })
})

test('builds rerun prompt only after replay repair changes', () => {
  assert.equal(buildRecordingReplayRerunPrompt({
    repairDirty: false,
    diagnostics: { tone: 'danger' },
    uploadIssueCount: 0,
    canRun: true,
  }), null)

  assert.deepEqual(buildRecordingReplayRerunPrompt({
    repairDirty: true,
    diagnostics: { tone: 'danger' },
    uploadIssueCount: 0,
    canRun: true,
  }), {
    title: '修复已应用',
    summary: '请保存并重新回放，确认最近一次问题已经消除。',
    actionLabel: '保存并重新回放',
    canRerun: true,
  })
})

test('rerun prompt asks to finish upload repairs before replaying', () => {
  assert.deepEqual(buildRecordingReplayRerunPrompt({
    repairDirty: true,
    diagnostics: { tone: 'warning' },
    uploadIssueCount: 2,
    canRun: true,
  }), {
    title: '修复还未完成',
    summary: '还有 2 个文件上传步骤需要重新绑定，处理完成后再保存并回放。',
    actionLabel: '继续修复上传',
    canRerun: false,
  })

  assert.equal(buildRecordingReplayRerunPrompt({
    repairDirty: true,
    diagnostics: { tone: 'success' },
    uploadIssueCount: 0,
    canRun: true,
  }), null)
})

test('builds selected failed step replay context from run detail', () => {
  const diagnostics = {
    failedStepSortOrder: 2,
    issueLabel: '定位器问题',
    reportAvailable: true,
  }
  const run = runDetail({
    status: 'FAILED',
    steps: [
      runStep({ sortOrder: 1, status: 'PASSED' }),
      runStep({
        sortOrder: 2,
        stepName: '点击提交',
        stepType: 'CLICK',
        status: 'FAILED',
        locatorType: 'CSS',
        locatorValue: 'button.submit',
        durationMs: 1534,
        errorMessage: 'locator resolved to 0 elements',
        screenshotArtifactId: 42,
        screenshotUrl: '/artifacts/42',
      }),
    ],
  })

  assert.equal(buildRecordingReplayStepContext({
    selectedSortOrder: 1,
    diagnostics,
    runDetail: run,
  }), null)

  assert.deepEqual(buildRecordingReplayStepContext({
    selectedSortOrder: 2,
    diagnostics,
    runDetail: run,
  }), {
    title: '最近一次回放失败',
    stepLabel: '第 2 步：点击提交',
    issueLabel: '定位器问题',
    errorMessage: 'locator resolved to 0 elements',
    locatorLabel: 'CSS · button.submit',
    durationLabel: '1.5s',
    screenshotUrl: '/artifacts/42',
    screenshotArtifactId: 42,
    reportAvailable: true,
  })
})

function taskSnapshot(overrides: Partial<RecordingReplayTaskSnapshot>): RecordingReplayTaskSnapshot {
  return {
    runId: 'replay-run',
    status: 'RUNNING',
    currentStage: null,
    statusMessage: null,
    errorMessage: null,
    progress: { current: 0, total: 0, percent: 0 },
    ...overrides,
  }
}

function runDetail(overrides: Partial<WebUiRunDetail['summary']> & { steps?: WebUiRunStepResult[] } = {}): WebUiRunDetail {
  return {
    summary: {
      id: 1,
      workspaceCode: 'ALL',
      workspaceName: 'ALL',
      batchId: null,
      batchSortOrder: null,
      caseId: 1,
      caseName: '录制用例',
      environmentId: null,
      environmentName: null,
      status: 'RUNNING',
      browserType: 'CHROMIUM',
      headless: false,
      baseUrl: null,
      durationMs: null,
      failureSummary: null,
      totalSteps: 0,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      operatorName: null,
      executionLocation: 'LOCAL_RUNNER',
      localRunnerRunId: 'replay-run',
      startedAt: null,
      finishedAt: null,
      createdAt: null,
      ...overrides,
    },
    context: null,
    steps: overrides.steps || [],
  }
}

function runStep(overrides: Partial<WebUiRunStepResult> = {}): WebUiRunStepResult {
  return {
    id: 1,
    caseStepId: 1,
    stepName: '打开页面',
    stepType: 'OPEN',
    status: 'PASSED',
    locatorType: null,
    locatorValue: null,
    inputValueSnapshot: null,
    durationMs: 100,
    errorMessage: null,
    screenshotArtifactId: null,
    screenshotUrl: null,
    sortOrder: 1,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}
