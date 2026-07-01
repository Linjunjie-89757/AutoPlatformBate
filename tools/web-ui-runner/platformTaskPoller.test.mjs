import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRunnerResourceSnapshot, maskRunnerReportValue, runApiScript } from './platformTaskPoller.mjs';

test('buildRunnerResourceSnapshot reports web tasks as high resource cost', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 8,
    currentRunId: 'run-web-001',
    currentTaskType: 'WEB_CASE_RUN',
    webElementValidateExecutor: true,
    webCaseRunExecutor: true,
  });

  assert.equal(snapshot.maxSlots, 8);
  assert.equal(snapshot.usedSlots, 5);
  assert.equal(snapshot.availableSlots, 3);
  assert.deepEqual(snapshot.runningRunIds, ['run-web-001']);
});

test('buildRunnerResourceSnapshot reports api tasks as low resource cost', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 4,
    currentRunId: 'run-api-001',
    currentTaskType: 'API_SCENARIO_RUN',
  });

  assert.equal(snapshot.maxSlots, 4);
  assert.equal(snapshot.usedSlots, 1);
  assert.equal(snapshot.availableSlots, 3);
});

test('buildRunnerResourceSnapshot caps used slots at max slots', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 3,
    currentRunId: 'run-web-002',
    currentTaskType: 'WEB_ELEMENT_VALIDATE',
  });

  assert.equal(snapshot.maxSlots, 3);
  assert.equal(snapshot.usedSlots, 3);
  assert.equal(snapshot.availableSlots, 0);
});

test('runApiScript supports legacy variable helpers for backend parity', () => {
  const runtimeVariables = { seed: 'alpha' };

  const result = runApiScript(`
    setVar('token', getVar('seed') + '-token');
    removeVar('seed');
    log(utils.upper('ok'));
  `, {
    runtimeVariables,
    phase: 'pre',
  });

  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(runtimeVariables, { token: 'alpha-token' });
});

test('runApiScript blocks Function constructor escape', () => {
  assert.throws(() => runApiScript(`
    variables.set('leak', Function('return process')().cwd());
  `, {
    runtimeVariables: {},
    phase: 'pre',
  }), /Function is not defined|not a function/);
});

test('runApiScript blocks constructor constructor escape', () => {
  assert.throws(() => runApiScript(`
    variables.set('leak', this.constructor.constructor('return 1')());
  `, {
    runtimeVariables: {},
    phase: 'pre',
  }), /constructor is not defined|blocked unsafe/);
});

test('maskRunnerReportValue redacts default sensitive fields and strings', () => {
  const report = {
    status: 'FAILED',
    statusCode: 500,
    request: {
      method: 'GET',
      url: 'https://api.example.test/orders?token=raw-token&traceId=ok',
      headers: {
        Authorization: 'Bearer raw-secret-token',
        Cookie: 'SESSION=raw-cookie',
        'X-Trace-Id': 'trace-001',
      },
      body: '{"password":"raw-password","name":"codex"}',
    },
    response: {
      headers: {
        'set-cookie': 'SESSION=next-cookie',
        'content-type': 'application/json',
      },
      body: '{"access_token":"raw-access","value":"ok"}',
    },
    extractedVariables: {
      ORDER_ID: '42',
      SERVER_TOKEN: 'raw-server-token',
    },
    assertions: [
      { expected: 'raw-server-token', actual: 'raw-server-token' },
    ],
  };

  const masked = maskRunnerReportValue(report);

  assert.equal(masked.status, 'FAILED');
  assert.equal(masked.statusCode, 500);
  assert.equal(masked.request.headers.Authorization, '******');
  assert.equal(masked.request.headers.Cookie, '******');
  assert.equal(masked.request.headers['X-Trace-Id'], 'trace-001');
  assert.equal(masked.request.url, 'https://api.example.test/orders?token=******&traceId=ok');
  assert.equal(masked.request.body, '{"password":"******","name":"codex"}');
  assert.equal(masked.response.headers['set-cookie'], '******');
  assert.equal(masked.response.headers['content-type'], 'application/json');
  assert.equal(masked.response.body, '{"access_token":"******","value":"ok"}');
  assert.equal(masked.extractedVariables.ORDER_ID, '42');
  assert.equal(masked.extractedVariables.SERVER_TOKEN, '******');
  assert.equal(masked.assertions[0].expected, '******');
  assert.equal(masked.assertions[0].actual, '******');
  assert.equal(report.request.headers.Authorization, 'Bearer raw-secret-token');
});

test('maskRunnerReportValue applies task masking rules in addition to defaults', () => {
  const masked = maskRunnerReportValue({
    message: 'created order SO-123456 for user',
    data: {
      customerCode: 'plain-value',
      publicValue: 'visible',
    },
  }, [
    {
      type: 'REGEX',
      pattern: 'SO-\\d+',
      replacement: 'SO-******',
      flags: 'g',
      enabled: true,
    },
    {
      type: 'FIELD_NAME',
      pattern: 'customerCode',
      replacement: '[masked]',
      enabled: true,
    },
  ]);

  assert.equal(masked.message, 'created order SO-****** for user');
  assert.equal(masked.data.customerCode, '[masked]');
  assert.equal(masked.data.publicValue, 'visible');
});
