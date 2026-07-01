import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { createRunnerTaskPoller } from './platformTaskPoller.mjs';

test('masks API case scenario and suite report payloads before uploading to platform', async () => {
  const targetRequests = [];
  const target = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    targetRequests.push({
      path: url.pathname,
      queryToken: url.searchParams.get('token') || url.searchParams.get('password'),
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
    });
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Server-Token': 'target-header-secret',
    });
    response.end(JSON.stringify({
      token: `target-body-secret-${url.pathname.slice(1)}`,
      password: 'target-password',
      ok: true,
    }));
  });
  const targetBaseUrl = await listenOnRandomPort(target);

  const reports = {
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  const tasks = [
    buildTask('mask_api_case', 'API_CASE_RUN', {
      apiCaseSnapshot: buildCaseSnapshot(targetBaseUrl, '/case', 'token'),
    }),
    buildTask('mask_api_scenario', 'API_SCENARIO_RUN', {
      scenarioSnapshot: {
        scenarioId: 3001,
        scenarioName: 'Masked scenario',
        steps: [{
          stepId: 'scenario-step',
          type: 'API_CASE',
          continueOnFailure: false,
          caseSnapshot: buildCaseSnapshot(targetBaseUrl, '/scenario', 'password'),
        }],
      },
    }),
    buildTask('mask_api_suite', 'API_SUITE_RUN', {
      suiteSnapshot: {
        suiteId: 4001,
        suiteName: 'Masked suite',
        items: [{
          itemId: 'suite-item',
          itemType: 'API_CASE',
          sortOrder: 1,
          caseSnapshot: buildCaseSnapshot(targetBaseUrl, '/suite', 'token'),
        }],
      },
      runOptions: {
        stopOnFirstFailure: true,
      },
    }),
  ];

  const platform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_masking_test',
          runnerToken: 'runner_token',
          protocolVersion: '1.0',
          accepted: true,
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/pull') {
      const task = tasks.shift() || null;
      return sendJson(response, 200, {
        success: true,
        data: {
          hasTask: Boolean(task),
          serverTime: new Date().toISOString(),
          pollIntervalMs: 1000,
          task,
        },
      });
    }

    const match = url.pathname.match(/^\/api\/public\/local-runner\/tasks\/([^/]+)\/(status|logs|steps|result)$/);
    if (request.method === 'POST' && match) {
      const kind = match[2] === 'result' ? 'results' : match[2];
      reports[kind].push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          accepted: true,
          status: body.status || 'RUNNING',
        },
      });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected route: ${request.method} ${url.pathname}`,
    });
  });
  const platformBaseUrl = await listenOnRandomPort(platform);

  const poller = createRunnerTaskPoller();
  try {
    await poller.start({
      apiBaseUrl: platformBaseUrl,
      intervalMs: 1000,
      runnerId: 'runner_masking_test',
      runnerToken: 'runner_token',
    });
    await waitFor(() => reports.results.length === 3, 5000);
  } finally {
    poller.stop('test-complete');
    await closeServer(platform);
    await closeServer(target);
  }

  assert.deepEqual(targetRequests.map(item => item.authorization), [
    'Bearer raw-token',
    'Bearer raw-token',
    'Bearer raw-token',
  ]);
  assert.deepEqual(targetRequests.map(item => item.cookie), [
    'SESSION=raw-password',
    'SESSION=raw-password',
    'SESSION=raw-password',
  ]);
  assert.deepEqual(targetRequests.map(item => item.queryToken), [
    'raw-token',
    'raw-password',
    'raw-token',
  ]);

  const uploaded = JSON.stringify([
    reports.status,
    reports.logs,
    reports.steps,
    reports.results,
  ]);
  for (const secret of [
    'Bearer raw-token',
    'SESSION=raw-password',
    'raw-token',
    'raw-password',
    'target-header-secret',
    'target-body-secret-case',
    'target-body-secret-scenario',
    'target-body-secret-suite',
    'target-password',
  ]) {
    assert.equal(uploaded.includes(secret), false, `uploaded reports leaked ${secret}`);
  }
  assert.equal(uploaded.includes('******'), true);
});

function buildTask(runId, taskType, payload) {
  return {
    runId,
    taskType,
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_masking_test',
    workspaceCode: 'account-open',
    protocolVersion: '1.0',
    priority: 'MANUAL',
    resourceCost: 1,
    createdAt: new Date().toISOString(),
    deadlineAt: null,
    timeoutPolicy: {
      requestTimeoutMs: 5000,
    },
    environmentSnapshot: {},
    variableSnapshot: {
      variables: {
        API_TOKEN: 'raw-token',
        PASSWORD: 'raw-password',
      },
    },
    scriptSnapshot: {},
    artifactRefs: [],
    maskingRules: [],
    screenshotPolicy: {},
    payload,
  };
}

function buildCaseSnapshot(targetBaseUrl, path, queryName) {
  return {
    caseId: path,
    caseName: `Masked ${path}`,
    request: {
      method: 'GET',
      url: `${targetBaseUrl}${path}?${queryName}={{${queryName === 'token' ? 'API_TOKEN' : 'PASSWORD'}}}`,
      headers: [
        { name: 'Authorization', value: 'Bearer {{API_TOKEN}}', enabled: true },
        { name: 'Cookie', value: 'SESSION={{PASSWORD}}', enabled: true },
      ],
    },
    assertions: [
      { assertionId: `${path}-status`, type: 'STATUS_CODE', expected: '200' },
    ],
    extractors: [
      {
        name: 'SERVER_TOKEN',
        type: 'JSON_PATH',
        extractScope: 'BODY',
        expression: '$.token',
        enabled: true,
      },
    ],
  };
}

async function listenOnRandomPort(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise(resolve => server.close(resolve));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function waitFor(predicate, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for condition');
}
