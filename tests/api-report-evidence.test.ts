import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLocalRunnerContextRows,
  buildStepEvidenceRows,
  isLocalRunnerReport,
} from '../src/entities/api-automation/lib/reportEvidence.ts'
import type { ApiRunStepResult } from '../src/entities/api-automation/model/types.ts'

test('report evidence detects Local Runner context and builds stable rows', () => {
  const contextSnapshotJson = JSON.stringify({
    executionLocation: 'LOCAL_RUNNER',
    runnerId: 'runner_local',
    runnerRunId: 'run_api_case_001',
    taskType: 'API_CASE_RUN',
  })

  assert.equal(isLocalRunnerReport(contextSnapshotJson), true)
  assert.deepEqual(buildLocalRunnerContextRows(contextSnapshotJson), [
    { label: '执行来源', value: '本地执行器' },
    { label: '本地执行器', value: 'runner_local' },
    { label: '本地任务', value: 'run_api_case_001' },
    { label: '任务类型', value: 'API_CASE_RUN' },
  ])
})

test('report evidence summarizes script processor and extracted variable rows', () => {
  const step = stepResult({
    processorResults: [
      {
        stage: 'PRE',
        name: 'prepareToken',
        success: true,
        durationMs: 12,
        outputVariables: {
          token: 'abc',
        },
      },
      {
        stage: 'POST',
        name: 'cleanup',
        success: false,
        message: 'script timeout',
      },
    ],
    extractionResults: [
      {
        variableName: 'userId',
        value: 'u-001',
        success: true,
      },
    ],
  })

  assert.deepEqual(buildStepEvidenceRows(step), [
    {
      type: 'processor',
      label: 'PRE script',
      name: 'prepareToken',
      status: '通过',
      value: '输出变量: {"token":"abc"}',
      tone: 'success',
    },
    {
      type: 'processor',
      label: 'POST script',
      name: 'cleanup',
      status: '失败',
      value: 'script timeout',
      tone: 'danger',
    },
    {
      type: 'extraction',
      label: '提取变量',
      name: 'userId',
      status: '通过',
      value: 'u-001',
      tone: 'success',
    },
  ])
})

function stepResult(overrides: Partial<ApiRunStepResult>): ApiRunStepResult {
  return {
    id: 1,
    reportId: 1,
    stepOrder: 1,
    stepName: 'step',
    definitionId: 1,
    success: true,
    durationMs: 10,
    request: null,
    response: null,
    assertionResults: [],
    extractionResults: [],
    processorResults: [],
    errorMessage: null,
    createdAt: null,
    ...overrides,
  }
}
