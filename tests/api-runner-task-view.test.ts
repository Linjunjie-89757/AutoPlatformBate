import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildApiReportKey,
  extractRunnerRunId,
  formatApiRunnerTaskStatus,
  isApiRunnerTaskTerminal,
} from '../src/entities/api-automation/lib/apiRunnerTaskView.ts'
import type { ApiRunResult } from '../src/entities/api-automation/model/types.ts'

test('api runner task view extracts run id from current local runner response shape', () => {
  const response: ApiRunResult = {
    taskId: null,
    reportId: null,
    taskName: 'api_scenario_1_100',
    reportName: null,
    result: 'PENDING',
    failureSummary: 'Local Runner task created',
    dataIterations: [],
    stepResults: [],
  }

  assert.equal(extractRunnerRunId(response), 'api_scenario_1_100')
})

test('api runner task view formats terminal status and report key', () => {
  assert.equal(isApiRunnerTaskTerminal('SUCCESS'), true)
  assert.equal(isApiRunnerTaskTerminal('RUNNING'), false)
  assert.equal(isApiRunnerTaskTerminal('TIMEOUT'), true)
  assert.equal(isApiRunnerTaskTerminal('RUNNER_OFFLINE'), true)
  assert.equal(formatApiRunnerTaskStatus('ASSIGNED'), '已领取')
  assert.equal(formatApiRunnerTaskStatus('SUCCESS'), '成功')
  assert.equal(formatApiRunnerTaskStatus('TIMEOUT'), '执行超时')
  assert.equal(formatApiRunnerTaskStatus('RUNNER_OFFLINE'), 'Runner 离线')
  assert.equal(buildApiReportKey('SCENARIO', 12), 'scenario:12')
  assert.equal(buildApiReportKey('API_CASE', 7), 'case:7')
})
