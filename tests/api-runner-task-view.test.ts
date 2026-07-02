import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildApiReportKey,
  extractRunnerRunId,
  formatApiRunnerTaskStatus,
  isApiRunnerReportForRun,
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
  assert.equal(buildApiReportKey('SUITE', 9), 'suite:9')
})

test('api runner task view matches reports by Local Runner run id', () => {
  const context = JSON.stringify({
    executionLocation: 'LOCAL_RUNNER',
    runnerId: 'runner-a',
    runnerRunId: 'api_scenario_4_100',
    taskType: 'API_SCENARIO_RUN',
  })

  assert.equal(isApiRunnerReportForRun(context, 'api_scenario_4_100'), true)
  assert.equal(isApiRunnerReportForRun(context, 'api_scenario_4_200'), false)
  assert.equal(isApiRunnerReportForRun('{bad-json', 'api_scenario_4_100'), false)
  assert.equal(isApiRunnerReportForRun({ executionLocation: 'SERVER', runnerRunId: 'api_scenario_4_100' }, 'api_scenario_4_100'), false)
  assert.equal(isApiRunnerReportForRun({
    executionLocation: 'LOCAL_RUNNER',
    runnerRunId: 'api_suite_8_100',
    taskType: 'API_SUITE_RUN',
  }, 'api_suite_8_100'), true)
})
