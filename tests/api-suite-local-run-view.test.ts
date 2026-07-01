import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildApiSuiteLocalRunNotice,
  findLatestSuiteLocalRunnerHistory,
} from '../src/entities/api-execution-suite/lib/localRunView.ts'
import type { ApiExecutionSuiteRunHistoryItem } from '../src/entities/api-execution-suite/model/types.ts'

test('api suite local run view finds latest local runner suite history', () => {
  const histories: ApiExecutionSuiteRunHistoryItem[] = [
    {
      id: 10,
      workspaceCode: 'risk-ops',
      workspaceName: null,
      suiteId: 8001,
      suiteName: 'Nightly suite',
      moduleId: null,
      moduleName: null,
      priority: 'P1',
      reportId: 101,
      result: 'FAILED',
      failureSummary: null,
      totalCount: 2,
      successCount: 1,
      failedCount: 1,
      skippedCount: 0,
      durationMs: 200,
      environmentId: null,
      variableSetId: null,
      runMode: 'SERIAL',
      runOn: 'SERVER',
      continueOnFailure: false,
      globalTimeoutMs: 300000,
      stepFailureRetryCount: 0,
      defaultStepWaitMs: 0,
      dataDrivenEnabled: false,
      dataFileId: null,
      dataFileName: null,
      dataRowCount: 0,
      branchName: null,
      triggerSource: null,
      operatorId: null,
      operatorName: 'Server',
      createdAt: '2026-06-29T10:00:00',
    },
    {
      id: 12,
      workspaceCode: 'risk-ops',
      workspaceName: null,
      suiteId: 8001,
      suiteName: 'Nightly suite',
      moduleId: null,
      moduleName: null,
      priority: 'P1',
      reportId: 102,
      result: 'SUCCESS',
      failureSummary: null,
      totalCount: 2,
      successCount: 2,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 180,
      environmentId: null,
      variableSetId: null,
      runMode: 'SERIAL',
      runOn: 'LOCAL_RUNNER',
      continueOnFailure: false,
      globalTimeoutMs: 300000,
      stepFailureRetryCount: 0,
      defaultStepWaitMs: 0,
      dataDrivenEnabled: false,
      dataFileId: null,
      dataFileName: null,
      dataRowCount: 0,
      branchName: null,
      triggerSource: null,
      operatorId: null,
      operatorName: 'Local Runner',
      createdAt: '2026-06-29T10:02:00',
    },
  ]

  const latest = findLatestSuiteLocalRunnerHistory(histories)

  assert.equal(latest?.id, 12)
})

test('api suite local run notice exposes runner task and report key states', () => {
  const running = buildApiSuiteLocalRunNotice({
    runId: 'api_suite_8001_001',
    history: null,
  })

  assert.equal(running.visible, true)
  assert.equal(running.title, '本地执行器任务已创建')
  assert.equal(running.reportKey, null)
  assert.match(running.description, /api_suite_8001_001/)

  const completed = buildApiSuiteLocalRunNotice({
    runId: 'api_suite_8001_001',
    history: {
      id: 12,
      result: 'SUCCESS',
    },
  })

  assert.equal(completed.visible, true)
  assert.equal(completed.title, '本地执行器报告已生成')
  assert.equal(completed.reportKey, 'suite:12')
  assert.equal(completed.tone, 'success')
})
