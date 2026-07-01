import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRunnerTaskLogCopyText,
  formatRunnerTaskLogLine,
  normalizeLocalRunnerTaskDetail,
  readRunnerTaskDurationMs,
  readRunnerTaskSummary,
} from '../src/entities/local-runner/lib/taskDetailView.ts'
import type { LocalRunnerTaskDetailResponse } from '../src/entities/local-runner/model/types.ts'

test('normalizes local runner task detail logs and summary fields', () => {
  const detail = normalizeLocalRunnerTaskDetail(taskDetail({
    progress: { current: 1, total: 2, percent: 50 },
    result: {
      durationMs: 1234,
      summary: {
        totalSteps: 2,
        failedSteps: 1,
      },
    },
    logs: [
      {
        sequenceNo: 7,
        level: 'ERROR',
        message: 'Assertion failed',
        stepId: 'step-1',
        data: { status: 500 },
        loggedAt: '2026-07-02T00:00:00',
      },
    ],
  }))

  assert.equal(detail.progress.percent, 50)
  assert.deepEqual(readRunnerTaskSummary(detail), { totalSteps: 2, failedSteps: 1 })
  assert.equal(readRunnerTaskDurationMs(detail), 1234)
  assert.deepEqual(detail.logs[0], {
    sequenceNo: 7,
    level: 'ERROR',
    message: 'Assertion failed',
    stepId: 'step-1',
    data: { status: 500 },
    loggedAt: '2026-07-02T00:00:00',
  })
})

test('builds stable local runner log copy text', () => {
  const detail = normalizeLocalRunnerTaskDetail(taskDetail({
    logs: [
      {
        sequenceNo: 1,
        level: 'INFO',
        message: 'Start API request',
        stepId: 'step-1',
        data: { url: '/orders' },
        loggedAt: '2026-07-02T00:00:00',
      },
    ],
  }))

  assert.equal(
    formatRunnerTaskLogLine(detail.logs[0]),
    '[2026-07-02T00:00:00] INFO step=step-1 Start API request {"url":"/orders"}',
  )
  assert.equal(
    buildRunnerTaskLogCopyText(detail),
    [
      'runId: run-detail',
      'taskType: API_CASE_RUN',
      'status: FAILED',
      'runnerId: runner-a',
      '',
      '[2026-07-02T00:00:00] INFO step=step-1 Start API request {"url":"/orders"}',
    ].join('\n'),
  )
})

function taskDetail(overrides: Partial<LocalRunnerTaskDetailResponse> = {}): LocalRunnerTaskDetailResponse {
  return {
    runId: 'run-detail',
    taskType: 'API_CASE_RUN',
    runnerId: 'runner-a',
    status: 'FAILED',
    currentStage: 'ASSERT',
    progress: { current: 0, total: 0, percent: 0 },
    statusMessage: null,
    errorMessage: null,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    lastReportedAt: null,
    envelope: {},
    result: {},
    logs: [],
    ...overrides,
  }
}
